const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn, execFile } = require('child_process');
const os = require('os');
const { pipeline } = require('stream/promises');

let mainWindow = null;

const userData = app.getPath('userData');
const settingsPath = path.join(userData, 'settings.json');
const binDir = path.join(userData, 'bin');
fs.mkdirSync(binDir, { recursive: true });

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
const send = (channel, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
};

/* ---------------- tool (yt-dlp / ffmpeg) management ---------------- */

function exeCandidates() {
  const base = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
  return [path.join(base, 'bin'), base, binDir];
}

function isFile(p) { try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; } }

function findInPath(cmd) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
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

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const doGet = (u, redirects) => {
      const mod = u.startsWith('https') ? https : http;
      const req = mod.get(u, { headers: { 'User-Agent': 'RetroRIP' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 8) {
          res.resume();
          return doGet(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode + ' for ' + u));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let done = 0;
        res.on('data', (c) => {
          done += c.length;
          if (onProgress && total) onProgress(done / total);
        });
        const out = fs.createWriteStream(dest);
        pipeline(res, out).then(resolve).catch(reject);
      });
      req.on('error', reject);
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

let toolsBusy = false;

async function ensureTools() {
  if (toolsBusy) return toolsStatus();
  toolsBusy = true;
  try {
    if (!findTool('yt-dlp')) {
      send('tools:progress', { tool: 'yt-dlp', progress: 0, status: 'downloading' });
      const dest = path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
      await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        dest, (p) => send('tools:progress', { tool: 'yt-dlp', progress: p, status: 'downloading' }));
      if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
      send('tools:progress', { tool: 'yt-dlp', progress: 1, status: 'ready' });
    }
    if (!findTool('ffmpeg')) {
      send('tools:progress', { tool: 'ffmpeg', progress: 0, status: 'downloading' });
      if (process.platform === 'win32') {
        const zip = path.join(binDir, 'ffmpeg.zip');
        await downloadFile('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
          zip, (p) => send('tools:progress', { tool: 'ffmpeg', progress: p * 0.9, status: 'downloading' }));
        const tmp = path.join(binDir, 'ffmpeg-tmp');
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        await runCmd('powershell.exe', ['-NoProfile', '-Command',
          `Expand-Archive -Force -Path '${zip}' -DestinationPath '${tmp}'`]);
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
  } finally {
    toolsBusy = false;
  }
  return toolsStatus();
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
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const isDev = !app.isPackaged;
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  ensureTools();
}

app.whenReady().then(() => {
  try { nativeTheme.on('updated', applyMaterial); } catch (e) {}
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

/* ---------------- IPC ---------------- */

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (_e, s) => {
  const merged = { ...loadSettings(), ...s };
  saveSettings(merged);
  applyMaterial();
  return merged;
});

ipcMain.handle('dialog:pickFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});

ipcMain.handle('shell:openPath', (_e, p) => shell.openPath(p));
ipcMain.handle('file:delete', (_e, p) => {
  try { fs.rmSync(p, { force: true }); return true; } catch (e) { return false; }
});
ipcMain.handle('shell:showItem', (_e, p) => shell.showItemInFolder(p));

ipcMain.handle('tools:status', () => toolsStatus());
ipcMain.handle('tools:ensure', () => ensureTools());

ipcMain.handle('library:list', (_e, folder) => {
  try {
    if (!fs.existsSync(folder)) return [];
    const exts = new Set(['.mp3', '.mp4', '.avi', '.wav', '.flac', '.m4a', '.mkv', '.webm', '.mov']);
    const out = [];
    const walk = (dir) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else {
          const ext = path.extname(e.name).toLowerCase();
          if (exts.has(ext)) {
            const st = fs.statSync(full);
            out.push({ name: e.name, path: full, size: st.size, mtime: st.mtimeMs, ext });
          }
        }
      }
    };
    walk(folder);
    out.sort((a, b) => b.mtime - a.mtime);
    return out;
  } catch (e) { return []; }
});

ipcMain.handle('convert:start', async (_e, payload) => {
  const settings = loadSettings();
  const isAudio = ['mp3', 'wav', 'flac', 'm4a'].includes(payload.format);
  const outFolder = isAudio ? (payload.audioFolder || settings.audioFolder) : (payload.videoFolder || settings.videoFolder);
  fs.mkdirSync(outFolder, { recursive: true });

  const ytdlp = findTool('yt-dlp');
  const ffmpeg = findTool('ffmpeg');
  if (!ytdlp) {
    send('job:failed', { id: payload.id, error: 'yt-dlp is not installed. Open Settings and press "Install components".' });
    return { started: false, error: 'yt-dlp missing' };
  }

  const qualityMap = { audio: { high: '320', medium: '192', low: '128' } };
  const args = [];
  const url = payload.url;
  const fmt = payload.format;
  const q = payload.quality || (isAudio ? settings.audioQuality : settings.videoQuality);

  if (isAudio) {
    args.push('-x', '--audio-format', fmt);
    const kb = qualityMap.audio[q] || '192';
    if (fmt === 'mp3') args.push('--audio-quality', kb + 'K');
  } else {
    if (fmt === 'mp4') {
      if (q === 'high') args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
      else if (q === 'medium') args.push('-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]');
      else args.push('-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]');
      args.push('--merge-output-format', 'mp4');
    } else if (fmt === 'avi') {
      args.push('-f', 'bestvideo+bestaudio/best');
      args.push('--merge-output-format', 'avi');
    } else {
      args.push('-f', 'best');
    }
  }

  if (ffmpeg) args.push('--ffmpeg-location', ffmpeg);
  args.push('-o', path.join(outFolder, '%(title)s.%(ext)s'));
  args.push('--no-playlist', '--newline', '--no-colors', '--no-warnings');
  args.push(url);

  const proc = spawn(ytdlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const job = { id: payload.id, proc, url, format: fmt, folder: outFolder, status: 'downloading', progress: 0, error: null, title: '' };
  jobs.set(payload.id, job);

  let stdoutBuf = '';
  let stderrBuf = '';

  proc.stdout.on('data', (d) => {
    stdoutBuf += d.toString();
    const lines = stdoutBuf.split(/\r|\n/);
    stdoutBuf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const mTitle = t.match(/\[download\]\s+Destination:\s+(.+)/);
      if (mTitle) {
        job.title = path.basename(mTitle[1]);
        send('job:progress', { id: payload.id, progress: job.progress, title: job.title });
      }
      const mProg = t.match(/(\d+\.?\d*)%/);
      if (mProg) {
        job.progress = Math.min(99.5, parseFloat(mProg[1]));
        send('job:progress', { id: payload.id, progress: job.progress, title: job.title });
      }
      if (t.includes('has already been downloaded')) job.progress = 99.5;
    }
  });
  proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });

  proc.on('close', (code) => {
    if (code === 0) {
      job.status = 'done';
      job.progress = 100;
      send('job:done', { id: payload.id, folder: outFolder, title: job.title });
    } else {
      job.status = 'failed';
      job.error = (stderrBuf.trim() || stdoutBuf.trim() || `yt-dlp exited with code ${code}`).split('\n').slice(-6).join('\n');
      send('job:failed', { id: payload.id, error: job.error });
    }
    jobs.delete(payload.id);
  });

  proc.on('error', (err) => {
    job.status = 'failed';
    job.error = err.message;
    send('job:failed', { id: payload.id, error: err.message });
    jobs.delete(payload.id);
  });

  return { started: true };
});

ipcMain.handle('convert:cancel', (_e, id) => {
  const job = jobs.get(id);
  if (job && job.proc) { try { job.proc.kill(); } catch (e) {} }
  jobs.delete(id);
  return true;
});
