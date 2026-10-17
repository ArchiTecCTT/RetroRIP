const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { spawn, execFile, execFileSync } = require('child_process');
const os = require('os');
const { pathToFileURL } = require('url');
const { pipeline } = require('stream/promises');

let mainWindow = null;

// Only one copy of RetroRIP at a time, so two windows never download the tools into the same files.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

const userData = app.getPath('userData');
const settingsPath = path.join(userData, 'settings.json');
const binDir = path.join(userData, 'bin');
fs.mkdirSync(binDir, { recursive: true });

const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'm4a'];
const VIDEO_FORMATS = ['mp4', 'avi'];
const QUALITIES = ['high', 'medium', 'low'];
const MEDIA_EXTS = new Set(['.mp3', '.mp4', '.avi', '.wav', '.flac', '.m4a', '.mkv', '.webm', '.mov']);
const MAX_PARALLEL = 3;

function defaultSettings() {
  return {
    audioFolder: path.join(os.homedir(), 'Music'),
    videoFolder: path.join(os.homedir(), 'Videos'),
    theme: 'system',
    accent: 'system',
    audioQuality: 'high',
    videoQuality: 'high',
  };
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaultSettings(), ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
    }
  } catch (e) {}
  return defaultSettings();
}
function saveSettings(s) {
  try { fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2)); } catch (e) {}
}
const jobs = new Map();
const waiting = []; // downloads waiting for a free slot (at most MAX_PARALLEL run at once)
const send = (channel, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
};

/* ---------------- library paths ---------------- */

// True when p is somewhere inside dir (path.relative is case-insensitive on Windows).
function isInside(p, dir) {
  const rel = path.relative(path.resolve(dir), path.resolve(p));
  return rel !== '' && rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel);
}
function isSamePath(a, b) { return path.relative(path.resolve(a), path.resolve(b)) === ''; }
function mediaFolders() {
  const s = loadSettings();
  return [s.audioFolder, s.videoFolder];
}
// The page may only open/delete media files inside the Audio or Video folder, or open those folders.
function isLibraryFile(p) {
  return typeof p === 'string' && MEDIA_EXTS.has(path.extname(p).toLowerCase())
    && mediaFolders().some((d) => isInside(p, d));
}
function isLibraryFolder(p) {
  return typeof p === 'string' && mediaFolders().some((d) => isSamePath(d, p));
}

/* ---------------- tool (yt-dlp / ffmpeg) management ---------------- */

function exeCandidates() {
  const base = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
  return [path.join(base, 'bin'), base, binDir];
}

function isFile(p) { try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; } }

function findInPath(cmd) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const d of dirs) {
    for (const e of exts) {
      const p = path.join(d, cmd + e);
      if (isFile(p)) return p;
    }
  }
  return null;
}

function findTool(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  for (const d of exeCandidates()) {
    const p = path.join(d, exe);
    if (isFile(p)) return p;
  }
  return findInPath(exe.replace(/\.exe$/, ''));
}

function toolsStatus() {
  return {
    ytdlp: findTool('yt-dlp'),
    ffmpeg: findTool('ffmpeg'),
    platform: process.platform,
  };
}

// Name of the yt-dlp release file for this computer (also its name in SHA2-256SUMS).
function ytdlpAsset() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return 'yt-dlp_linux';
}

// Reads a published checksum file and returns the SHA-256 for fileName
// (or the first hash, for files that only contain one).
async function fetchChecksum(url, fileName) {
  const res = await fetch(url, { headers: { 'User-Agent': 'RetroRIP' } });
  if (!res.ok || !res.url.startsWith('https://')) throw new Error('Could not get the checksum from ' + url);
  for (const line of (await res.text()).split(/\r?\n/)) {
    const [hash, name] = line.trim().split(/\s+/);
    if (/^[0-9a-f]{64}$/i.test(hash || '') && (!fileName || name === fileName)) return hash.toLowerCase();
  }
  throw new Error('Checksum not found in ' + url);
}

// Downloads over https only (redirects too) into "<dest>.part", checks the SHA-256, and only then
// renames it to dest. A dropped connection or a tampered file never leaves a broken tool behind.
function downloadFile(url, dest, expectedSha256, onProgress) {
  const part = dest + '.part';
  return new Promise((resolve, reject) => {
    const fail = (err) => { fs.rmSync(part, { force: true }); reject(err); };
    const doGet = (u, redirects) => {
      if (!u.startsWith('https://')) return fail(new Error('Refusing a non-https download: ' + u));
      const req = https.get(u, { headers: { 'User-Agent': 'RetroRIP' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 8) {
          res.resume();
          return doGet(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return fail(new Error('HTTP ' + res.statusCode + ' for ' + u));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        const hash = crypto.createHash('sha256');
        let done = 0;
        res.on('data', (c) => {
          hash.update(c);
          done += c.length;
          if (onProgress && total) onProgress(done / total);
        });
        pipeline(res, fs.createWriteStream(part)).then(() => {
          const actual = hash.digest('hex');
          if (actual !== expectedSha256) return fail(new Error('Checksum mismatch for ' + path.basename(dest) + ', download discarded'));
          fs.renameSync(part, dest);
          resolve();
        }).catch(fail);
      });
      req.on('error', fail);
      req.setTimeout(60000, () => { req.destroy(new Error('timeout')); });
    };
    doGet(url, 0);
  });
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(err); else resolve({ stdout, stderr });
    });
  });
}

// yt-dlp.exe starts a second copy of itself (and ffmpeg) to do the work, so stop the
// whole process tree, not just the first process.
function killTree(proc, sync) {
  if (!proc || proc.exitCode !== null) return;
  if (process.platform === 'win32') {
    const args = ['/pid', String(proc.pid), '/T', '/F'];
    try {
      if (sync) execFileSync('taskkill', args, { windowsHide: true, stdio: 'ignore' });
      else execFile('taskkill', args, { windowsHide: true }, () => {});
    } catch (e) {}
  } else {
    try { proc.kill(); } catch (e) {}
  }
}

// Installs and updates run one at a time, and downloads wait for them,
// so yt-dlp is never replaced while it is running.
let toolsJob = null;
function withTools(task) {
  const run = (toolsJob || Promise.resolve()).catch(() => {}).then(task);
  const p = run.finally(() => { if (toolsJob === p) toolsJob = null; });
  toolsJob = p;
  return run;
}

const ytdlpStamp = path.join(binDir, 'yt-dlp.checked');
const WEEK = 7 * 24 * 60 * 60 * 1000;

// YouTube changes often and old yt-dlp versions stop working, so keep the copy RetroRIP
// downloaded up to date. "yt-dlp -U" checks the new version itself before replacing the file.
async function updateYtdlp(force) {
  const exe = findTool('yt-dlp');
  if (!exe) return 'yt-dlp is not installed yet.';
  if (!isSamePath(path.dirname(exe), binDir)) {
    return 'yt-dlp was installed outside RetroRIP (' + exe + '); update it the same way you installed it.';
  }
  let last = 0;
  try { last = fs.statSync(ytdlpStamp).mtimeMs; } catch (e) {}
  if (!force && Date.now() - last < WEEK) return 'yt-dlp was checked recently.';
  send('tools:progress', { tool: 'yt-dlp', progress: 0, status: 'updating' });
  try {
    const { stdout } = await runCmd(exe, ['-U']);
    fs.writeFileSync(ytdlpStamp, new Date().toISOString());
    return stdout.trim().split(/\r?\n/).pop() || 'yt-dlp is up to date.';
  } finally {
    send('tools:progress', { tool: 'yt-dlp', progress: 1, status: 'ready' });
  }
}

async function installTools() {
  try {
    if (!findTool('yt-dlp')) {
      send('tools:progress', { tool: 'yt-dlp', progress: 0, status: 'downloading' });
      const asset = ytdlpAsset();
      const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
      const dest = path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
      const sha = await fetchChecksum(base + 'SHA2-256SUMS', asset);
      await downloadFile(base + asset, dest, sha,
        (p) => send('tools:progress', { tool: 'yt-dlp', progress: p, status: 'downloading' }));
      if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
      fs.writeFileSync(ytdlpStamp, new Date().toISOString());
      send('tools:progress', { tool: 'yt-dlp', progress: 1, status: 'ready' });
    }
    if (!findTool('ffmpeg')) {
      send('tools:progress', { tool: 'ffmpeg', progress: 0, status: 'downloading' });
      if (process.platform === 'win32') {
        const zip = path.join(binDir, 'ffmpeg.zip');
        const zipUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
        const sha = await fetchChecksum(zipUrl + '.sha256');
        await downloadFile(zipUrl, zip, sha,
          (p) => send('tools:progress', { tool: 'ffmpeg', progress: p * 0.9, status: 'downloading' }));
        const tmp = path.join(binDir, 'ffmpeg-tmp');
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        // Windows 10/11 include tar.exe, which can unpack .zip files. The paths are passed as
        // separate arguments, so folder names with spaces, apostrophes or brackets are fine.
        const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
        await runCmd(tar, ['-xf', zip, '-C', tmp]);
        // locate ffmpeg.exe / ffprobe.exe
        const walk = (dir) => {
          let out = [];
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) out = out.concat(walk(full));
            else if (['ffmpeg.exe', 'ffprobe.exe'].includes(e.name.toLowerCase())) out.push(full);
          }
          return out;
        };
        for (const f of walk(tmp)) {
          fs.copyFileSync(f, path.join(binDir, path.basename(f)));
        }
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.rmSync(zip, { force: true });
      } else {
        // Linux/macOS: rely on system package manager hint
        send('tools:progress', { tool: 'ffmpeg', progress: 1, status: 'missing' });
      }
      send('tools:progress', { tool: 'ffmpeg', progress: 1, status: toolsStatus().ffmpeg ? 'ready' : 'missing' });
    }
  } catch (e) {
    send('tools:progress', { tool: 'error', progress: 1, status: 'error', message: e.message });
  }
  // Not fatal if this fails (e.g. offline): the current version keeps working for now.
  try { await updateYtdlp(false); } catch (e) {}
  return toolsStatus();
}

// If tools are already being installed, share that run instead of starting a second one.
function ensureTools() {
  return toolsJob || withTools(installTools);
}

/* ---------------- window ---------------- */

function effectiveDark() {
  const st = loadSettings();
  if (st.theme === 'dark') return true;
  if (st.theme === 'light') return false;
  try { return nativeTheme.shouldUseDarkColors; } catch (e) { return false; }
}
function windowMaterial() {
  return effectiveDark() ? 'acrylic' : 'mica';
}
function applyMaterial() {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.setBackgroundMaterial(windowMaterial()); } catch (e) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    title: 'RetroRIP',
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { backgroundMaterial: windowMaterial() } : {}),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#808080',
      height: 40,
    },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The window only ever shows RetroRIP's own page. Block navigation (for example a link
  // dragged onto the window) and pop-ups, so no website can load here and reach window.api.
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const isDev = !app.isPackaged;
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  ensureTools();
}

app.whenReady().then(() => {
  if (!gotLock) return;
  try { nativeTheme.on('updated', applyMaterial); } catch (e) {}
  createWindow();
});
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});
app.on('before-quit', () => {
  waiting.length = 0;
  for (const job of jobs.values()) {
    job.cancelled = true;
    killTree(job.proc, true);
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

/* ---------------- IPC ---------------- */

// Settings the page may change, and the values allowed for each. Folders are only changed
// through the folder picker below, so the page can't point open/delete at other places.
const SETTING_CHOICES = {
  theme: ['system', 'light', 'dark'],
  accent: ['system', 'red', 'white', 'pink', 'matcha', 'purple', 'blue'],
  audioQuality: QUALITIES,
  videoQuality: QUALITIES,
};

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (_e, patch) => {
  const merged = loadSettings();
  for (const [key, allowed] of Object.entries(SETTING_CHOICES)) {
    if (patch && allowed.includes(patch[key])) merged[key] = patch[key];
  }
  saveSettings(merged);
  applyMaterial();
  return merged;
});

ipcMain.handle('dialog:pickFolder', async (_e, key) => {
  if (key !== 'audioFolder' && key !== 'videoFolder') return null;
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  const merged = { ...loadSettings(), [key]: r.filePaths[0] };
  saveSettings(merged);
  return merged;
});

ipcMain.handle('shell:openPath', (_e, p) => {
  if (!isLibraryFile(p) && !isLibraryFolder(p)) return 'Not allowed';
  return shell.openPath(p);
});
ipcMain.handle('file:delete', (_e, p) => {
  if (!isLibraryFile(p)) return false;
  try { fs.rmSync(p); return true; } catch (e) { return false; }
});
ipcMain.handle('shell:showItem', (_e, p) => {
  if (isLibraryFile(p)) shell.showItemInFolder(p);
});

ipcMain.handle('tools:status', () => toolsStatus());
ipcMain.handle('tools:ensure', () => ensureTools());
ipcMain.handle('tools:update', async () => {
  if (jobs.size || waiting.length) return { ok: false, message: 'Wait for the current downloads to finish, then try again.' };
  try {
    return { ok: true, message: await withTools(() => updateYtdlp(true)) };
  } catch (e) {
    return { ok: false, message: e.message };
  }
});

ipcMain.handle('library:list', async (_e, folder) => {
  if (!isLibraryFolder(folder)) return [];
  const out = [];
  // Async so a big folder doesn't freeze the window; a few levels deep covers Artist/Album folders.
  const walk = async (dir, depth) => {
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < 4) await walk(full, depth + 1);
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (!MEDIA_EXTS.has(ext)) continue;
      try {
        const st = await fs.promises.stat(full);
        // pathToFileURL escapes characters like # and % that are common in video titles.
        out.push({ name: e.name, path: full, url: pathToFileURL(full).href, size: st.size, mtime: st.mtimeMs, ext });
      } catch (err) {} // file vanished or is locked; skip it
    }
  };
  await walk(folder, 0);
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
});

// Only plain web links are accepted, so text like "--exec=..." can never reach yt-dlp.
function cleanUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
}

ipcMain.handle('convert:start', async (_e, payload) => {
  if (!payload || typeof payload.id !== 'string') return { started: false, error: 'Bad request' };
  const fail = (error) => {
    send('job:failed', { id: payload.id, error });
    return { started: false, error };
  };
  const fmt = payload.format;
  const isAudio = AUDIO_FORMATS.includes(fmt);
  if (!isAudio && !VIDEO_FORMATS.includes(fmt)) return fail('Unsupported format: ' + fmt);
  const url = cleanUrl(payload.url);
  if (!url) return fail('That doesn\'t look like a web link. Paste the full link, starting with https://');

  if (toolsJob) await toolsJob.catch(() => {});
  const settings = loadSettings();
  const outFolder = isAudio ? settings.audioFolder : settings.videoFolder;
  try {
    fs.mkdirSync(outFolder, { recursive: true });
  } catch (e) {
    return fail('Can\'t save to ' + outFolder + ' (' + e.message + '). Pick another folder in Settings.');
  }

  const ytdlp = findTool('yt-dlp');
  const ffmpeg = findTool('ffmpeg');
  if (!ytdlp) return fail('yt-dlp is not installed. Open Settings and press "Install components".');

  const qualityMap = { audio: { high: '320', medium: '192', low: '128' } };
  const args = ['--ignore-config']; // ignore any yt-dlp config file on this PC
  const q = QUALITIES.includes(payload.quality) ? payload.quality : (isAudio ? settings.audioQuality : settings.videoQuality);

  if (isAudio) {
    args.push('-x', '--audio-format', fmt);
    const kb = qualityMap.audio[q] || '192';
    if (fmt === 'mp3') args.push('--audio-quality', kb + 'K');
  } else {
    if (fmt === 'mp4') {
      if (q === 'high') args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
      // "<=?" also accepts videos whose height is unknown (common outside YouTube) instead of failing.
      else if (q === 'medium') args.push('-f', 'bestvideo[height<=?720][ext=mp4]+bestaudio[ext=m4a]/best[height<=?720]');
      else args.push('-f', 'bestvideo[height<=?480][ext=mp4]+bestaudio[ext=m4a]/best[height<=?480]');
      args.push('--merge-output-format', 'mp4');
    } else if (fmt === 'avi') {
      args.push('-f', 'bestvideo+bestaudio/best');
      args.push('--merge-output-format', 'avi');
    }
  }

  if (ffmpeg) args.push('--ffmpeg-location', ffmpeg);
  // "%" starts a template code for yt-dlp, so a "%" in the folder name has to be doubled.
  args.push('-o', path.join(outFolder.replace(/%/g, '%%'), '%(title)s.%(ext)s'));
  args.push('--no-playlist', '--newline', '--no-colors', '--no-warnings');
  // "--" tells yt-dlp that what follows is the link, never an option.
  args.push('--', url);

  const job = { id: payload.id, ytdlp, args, url, format: fmt, folder: outFolder, status: 'downloading', progress: 0, error: null, title: '' };
  if (jobs.size >= MAX_PARALLEL) waiting.push(job);
  else runJob(job);
  return { started: true };
});

// Start waiting downloads while there are free slots.
function startWaiting() {
  while (jobs.size < MAX_PARALLEL && waiting.length) runJob(waiting.shift());
}

function runJob(job) {
  const proc = spawn(job.ytdlp, job.args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  job.proc = proc;
  jobs.set(job.id, job);

  let stdoutBuf = '';
  let stderrBuf = '';
  let finished = false;
  const finish = (error) => {
    if (finished) return;
    finished = true;
    jobs.delete(job.id);
    if (!job.cancelled) {
      if (error) {
        job.status = 'failed';
        job.error = error;
        send('job:failed', { id: job.id, error });
      } else {
        job.status = 'done';
        job.progress = 100;
        send('job:done', { id: job.id, folder: job.folder, title: job.title });
      }
    }
    startWaiting();
  };

  proc.stdout.on('data', (d) => {
    stdoutBuf += d.toString();
    const lines = stdoutBuf.split(/\r|\n/);
    stdoutBuf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      // The last "Destination"/"Merging" line is the final file (e.g. the .mp3 after conversion).
      const mTitle = t.match(/^\[(?:download|ExtractAudio)\]\s+Destination:\s+(.+)/) || t.match(/^\[Merger\] Merging formats into "(.+)"/);
      if (mTitle) {
        job.title = path.basename(mTitle[1]);
        send('job:progress', { id: job.id, progress: job.progress, title: job.title });
      }
      const mProg = t.match(/^\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (mProg) {
        job.progress = Math.min(99.5, parseFloat(mProg[1]));
        send('job:progress', { id: job.id, progress: job.progress, title: job.title });
      }
      if (t.includes('has already been downloaded')) job.progress = 99.5;
    }
  });
  proc.stderr.on('data', (d) => { stderrBuf = (stderrBuf + d.toString()).slice(-8000); });

  proc.on('close', (code) => {
    if (code === 0) finish(null);
    else finish((stderrBuf.trim() || stdoutBuf.trim() || `yt-dlp exited with code ${code}`).split('\n').slice(-6).join('\n'));
  });
  proc.on('error', (err) => finish(err.message));
}

ipcMain.handle('convert:cancel', (_e, id) => {
  const i = waiting.findIndex((j) => j.id === id);
  if (i >= 0) waiting.splice(i, 1);
  const job = jobs.get(id);
  if (job) {
    job.cancelled = true;
    killTree(job.proc);
  }
  return true;
});
