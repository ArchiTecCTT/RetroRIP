// Runs the PR's manual test checklist against the real packaged app on a Windows runner.
// Test-only: lives on the test/windows-checklist branch, not part of the PR.
const { _electron: electron } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const http = require('http');

const out = path.resolve(process.argv[2] || 'checklist-out');
fs.mkdirSync(out, { recursive: true });
const exe = path.resolve('release/win-unpacked/RetroRIP.exe');
const userData = path.join(process.env.APPDATA, 'RetroRIP'); // same folder as "retrorip" (case-insensitive)
// Awkward folder names on purpose: % (yt-dlp template), # (file URLs), apostrophe and brackets.
const audioDir = 'C:\\t\\Music 100% #1';
const videoDir = "C:\\t\\Videos [x] 'q'";
const YT = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo", 19 s
// YouTube usually blocks GitHub's machines ("confirm you're not a bot"), so the download tests use
// videos made on the runner and served from a local web server. "slow" files are sent at ~300 KB/s
// so Cancel and Quit can be tested mid-download.
const mediaDir = 'C:\\t\\media';
let SMALL = null;
let BIG = null;

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function record(name, ok, detail) {
  results.push({ name, ok, detail: detail == null ? '' : String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  --  ' + detail : ''}`);
}
async function step(name, fn) {
  try { record(name, true, await fn()); } catch (e) { record(name, false, String(e && e.message || e).split('\n')[0]); }
}
function count(image) {
  try {
    return execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' })
      .split('\n').filter((l) => l.toLowerCase().includes(image)).length;
  } catch { return -1; }
}
async function waitFor(fn, ms, every = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(every); }
  return null;
}

function startMediaServer() {
  const server = http.createServer((req, res) => {
    const name = path.basename(new URL(req.url, 'http://x').pathname);
    const f = path.join(mediaDir, name);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': fs.statSync(f).size });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(f, { highWaterMark: 64 * 1024 });
    res.on('close', () => stream.destroy());
    if (!name.startsWith('slow')) return stream.pipe(res);
    stream.on('data', (c) => { stream.pause(); res.write(c); setTimeout(() => stream.resume(), 200); });
    stream.on('end', () => res.end());
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}/`)));
}

(async () => {
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({
    audioFolder: audioDir, videoFolder: videoDir, theme: 'dark', accent: 'system', audioQuality: 'low', videoQuality: 'low',
  }));
  // Hide any yt-dlp/ffmpeg already on the runner's PATH, so the app has to download its own.
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH');
  env[pathKey] = env[pathKey].split(';').filter((d) => {
    try { return !fs.existsSync(path.join(d, 'ffmpeg.exe')) && !fs.existsSync(path.join(d, 'yt-dlp.exe')); } catch { return true; }
  }).join(';');

  const app = await electron.launch({ executablePath: exe, env, timeout: 120000 });
  const page = await app.firstWindow();
  const consoleMsgs = [];
  page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
  await page.getByText('Paste your link here.').waitFor({ timeout: 60000 });
  await page.evaluate(() => {
    window.__done = []; window.__failed = [];
    window.api.onJobDone((d) => window.__done.push(d));
    window.api.onJobFailed((d) => window.__failed.push(d));
  });
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') }).catch(() => {});
  const nav = (name) => page.getByRole('button', { name }).first().click();
  await shot('01-start');

  await step('First launch installs yt-dlp and ffmpeg (checksum-verified)', async () => {
    const t0 = Date.now();
    const s = await waitFor(async () => { const s = await page.evaluate(() => window.api.toolsStatus()); return s.ytdlp && s.ffmpeg ? s : null; }, 10 * 60000, 3000);
    if (!s) throw new Error('tools still missing: ' + JSON.stringify(await page.evaluate(() => window.api.toolsStatus())));
    const bin = path.join(userData, 'bin');
    const files = fs.readdirSync(bin);
    for (const f of ['yt-dlp.exe', 'ffmpeg.exe', 'ffprobe.exe', 'yt-dlp.checked']) if (!files.includes(f)) throw new Error('missing ' + f + ' in ' + files.join(','));
    if (files.some((f) => f.endsWith('.part') || f === 'ffmpeg.zip' || f === 'ffmpeg-tmp')) throw new Error('leftovers: ' + files.join(','));
    if (!s.ytdlp.toLowerCase().startsWith(bin.toLowerCase()) || !s.ffmpeg.toLowerCase().startsWith(bin.toLowerCase())) throw new Error('not using downloaded tools: ' + JSON.stringify(s));
    return `${Math.round((Date.now() - t0) / 1000)} s, bin = ${files.join(', ')}`;
  });
  await shot('02-tools-ready');

  await step('Make test videos with the downloaded ffmpeg', async () => {
    const ffmpeg = path.join(userData, 'bin', 'ffmpeg.exe');
    fs.mkdirSync(mediaDir, { recursive: true });
    const make = (name, secs, size, rate) => execFileSync(ffmpeg, ['-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `testsrc2=duration=${secs}:size=${size}:rate=25`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`,
      '-c:v', 'libx264', '-b:v', rate, '-c:a', 'aac', '-shortest', path.join(mediaDir, name)]);
    make('clip.mp4', 8, '640x360', '500k');
    make('slow-big.mp4', 60, '1280x720', '2M');
    const base = await startMediaServer();
    SMALL = base + 'clip.mp4';
    BIG = base + 'slow-big.mp4';
    return fs.readdirSync(mediaDir).map((f) => `${f} ${(fs.statSync(path.join(mediaDir, f)).size / 1e6).toFixed(1)} MB`).join(', ') + ' at ' + base;
  });

  await step('Dropping a link fills the link box', async () => {
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/uri-list', 'https://www.youtube.com/watch?v=dropped');
      document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    const v = await page.getByPlaceholder(/youtube/).inputValue();
    await page.getByPlaceholder(/youtube/).fill('');
    if (!v.includes('dropped')) throw new Error('box has ' + JSON.stringify(v));
    return v;
  });

  await step('Page cannot delete/open/list files outside the media folders', async () => {
    const r = await page.evaluate(async () => ({
      del: await window.api.deleteFile('C:\\Windows\\win.ini'),
      open: await window.api.openPath('C:\\Windows\\System32\\calc.exe'),
      list: (await window.api.libraryList('C:\\Windows')).length,
      set: await window.api.settingsSet({ audioFolder: 'C:\\Windows', theme: 'evil' }),
    }));
    if (r.del !== false || r.open !== 'Not allowed' || r.list !== 0) throw new Error(JSON.stringify(r));
    if (r.set.audioFolder !== audioDir || r.set.theme === 'evil') throw new Error('settings accepted: ' + JSON.stringify(r.set));
    if (!fs.existsSync('C:\\Windows\\win.ini')) throw new Error('win.ini was deleted!');
    return `delete=${r.del}, open=${JSON.stringify(r.open)}, list=${r.list}, folder unchanged`;
  });

  await step('Option-like "links" are rejected (no --exec)', async () => {
    const r = await page.evaluate(() => window.api.convertStart({ id: 'inj', url: '--exec=calc.exe', format: 'mp3', quality: 'high' }));
    await page.evaluate(() => { window.__failed = window.__failed.filter((f) => f.id !== 'inj'); });
    if (r.started) throw new Error('started!');
    return r.error;
  });

  await step('Content-Security-Policy is active, no CSP errors', async () => {
    const csp = await page.evaluate(() => (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content);
    if (!csp) throw new Error('no CSP meta');
    const bad = consoleMsgs.filter((m) => /Content Security Policy/i.test(m));
    if (bad.length) throw new Error(bad[0]);
    return csp;
  });

  // Starts a download through the UI and waits for it to finish.
  async function download(fmt, folder, ext, url) {
    if (!url) throw new Error('no test video');
    const before = await page.evaluate(() => [window.__done.length, window.__failed.length]);
    await nav('Convert');
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: fmt }).click();
    await page.getByPlaceholder(/youtube/).fill(url);
    await page.getByRole('button', { name: 'Convert' }).last().click();
    const r = await waitFor(() => page.evaluate(([d, f]) => (window.__done.length > d ? { ok: window.__done[d] }
      : window.__failed.length > f ? { err: window.__failed[f].error } : null), before), 8 * 60000);
    if (!r) throw new Error('timed out');
    if (r.err) throw new Error(r.err.split('\n').pop());
    const files = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith(ext));
    if (!files.length) throw new Error(`done, but no ${ext} in ${folder}: ${fs.readdirSync(folder).join(', ')}`);
    return `${folder}\\${files[files.length - 1]}`;
  }

  await step('MP3 download (folder name has % and #)', () => download('MP3', audioDir, '.mp3', SMALL));
  await nav('Downloads'); await shot('03-downloads');
  await step("MP4 download (folder name has [brackets] and 'apostrophes')", () => download('MP4', videoDir, '.mp4', SMALL));

  await step('Cancel stops every yt-dlp/ffmpeg process and shows Cancelled', async () => {
    const failedBefore = await page.evaluate(() => window.__failed.length);
    await nav('Convert');
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'MP4' }).click();
    await page.getByPlaceholder(/youtube/).fill(BIG);
    await page.getByRole('button', { name: 'Convert' }).last().click();
    if (!BIG) throw new Error('no test video');
    const running = await waitFor(() => (count('yt-dlp.exe') > 0 ? count('yt-dlp.exe') : 0), 60000, 1000);
    await sleep(8000);
    const progress = await page.getByText(/^\d+%$/).first().textContent().catch(() => '?');
    const during = count('yt-dlp.exe');
    await nav('Downloads');
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await sleep(5000);
    const after = { ytdlp: count('yt-dlp.exe'), ffmpeg: count('ffmpeg.exe') };
    await shot('04-cancelled');
    const failedAfter = await page.evaluate(() => window.__failed.length);
    const shown = await page.getByText('Cancelled', { exact: true }).count();
    if (!running) throw new Error('download never started');
    if (after.ytdlp || after.ffmpeg) throw new Error(`still running after Cancel: ${JSON.stringify(after)} (had ${during} yt-dlp.exe)`);
    if (failedAfter !== failedBefore) throw new Error('cancel was reported as a failure');
    if (!shown) throw new Error('no Cancelled badge');
    return `${during} yt-dlp.exe process(es) while downloading (at ${progress}), 0 after Cancel`;
  });

  await step('Library preview plays a file whose folder has % and #', async () => {
    await nav('Library');
    const audio = page.locator('audio').first();
    await audio.waitFor({ timeout: 20000 });
    const src = await audio.getAttribute('src');
    const dur = await audio.evaluate((a) => new Promise((r) => {
      if (a.readyState >= 1) return r(a.duration);
      a.addEventListener('loadedmetadata', () => r(a.duration));
      a.addEventListener('error', () => r('error ' + (a.error && a.error.code)));
      setTimeout(() => r('timeout'), 15000);
      a.load();
    }));
    await shot('05-library');
    if (typeof dur !== 'number' || !(dur > 0)) throw new Error(`could not load ${src}: ${dur}`);
    return `${dur.toFixed(1)} s from ${src}`;
  });

  await step('Update yt-dlp button', async () => {
    await nav('Settings');
    await page.getByRole('button', { name: 'Update yt-dlp' }).click();
    await page.getByRole('button', { name: 'Update yt-dlp' }).waitFor({ timeout: 120000 });
    await shot('06-settings');
    const card = await page.getByRole('button', { name: 'Update yt-dlp' }).locator('xpath=../..').innerText();
    const msg = card.split('\n').map((l) => l.trim()).filter(Boolean).pop();
    if (!/yt-dlp|version|date/i.test(msg)) throw new Error('no message: ' + card);
    return msg;
  });

  await step('Second copy of the app exits and leaves one window', async () => {
    const p = spawn(exe, [], { env, stdio: 'ignore' });
    const code = await new Promise((r) => { p.on('exit', (c) => r(c)); setTimeout(() => { try { p.kill(); } catch {} r('still running'); }, 20000); });
    if (code === 'still running') throw new Error('second instance kept running');
    if (app.windows().length !== 1) throw new Error(app.windows().length + ' windows');
    return 'exit code ' + code;
  });

  await step('(info) YouTube from a GitHub machine', async () => {
    const before = await page.evaluate(() => [window.__done.length, window.__failed.length]);
    await page.evaluate((u) => window.api.convertStart({ id: 'yt', url: u, format: 'mp3', quality: 'low' }), YT);
    const r = await waitFor(() => page.evaluate(([d, f]) => (window.__done.length > d ? 'downloaded fine'
      : window.__failed.length > f ? 'blocked: ' + window.__failed[f].error.split('\n').pop().slice(0, 120) : null), before), 3 * 60000);
    return (r || 'timed out') + ' (not counted: YouTube often blocks datacenter machines)';
  });

  // Last UI test: after a blocked navigation Playwright waits forever before clicks, so the
  // quit test below starts its download through window.api instead of the UI.
  await step('Window cannot be navigated to a website', async () => {
    const before = page.url();
    await page.evaluate(() => { location.href = 'https://example.com/'; });
    await sleep(2000);
    const opened = await page.evaluate(() => String(window.open('https://example.com/')));
    await sleep(1000);
    if (page.url() !== before) throw new Error('navigated to ' + page.url());
    if (app.windows().length !== 1) throw new Error('a new window opened');
    const title = await page.evaluate(() => document.body.innerText.includes('Settings'));
    if (!title) throw new Error('app page no longer shows its UI');
    return 'still on the app page and UI intact; window.open returned ' + opened;
  });

  await step('Quitting during a download leaves no yt-dlp/ffmpeg running', async () => {
    if (!BIG) throw new Error('no test video');
    await page.evaluate((u) => window.api.convertStart({ id: 'quit', url: u, format: 'mp4', quality: 'low' }), BIG);
    if (!(await waitFor(() => count('yt-dlp.exe') > 0, 60000, 1000))) throw new Error('download never started');
    await sleep(6000);
    const during = count('yt-dlp.exe');
    if (!during) throw new Error('download had already stopped before quitting');
    await app.close();
    await sleep(5000);
    const left = { ytdlp: count('yt-dlp.exe'), ffmpeg: count('ffmpeg.exe') };
    if (left.ytdlp || left.ffmpeg) throw new Error('left running: ' + JSON.stringify(left));
    return `${during} yt-dlp.exe while downloading, none left after quit`;
  });
  await app.close().catch(() => {});

  await step("tar.exe unpacks a zip in a folder with an apostrophe and brackets", async () => {
    const dir = "C:\\t\\O'Brien [test]";
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'hello.txt'), 'hi');
    const tar = path.join(process.env.SystemRoot, 'System32', 'tar.exe');
    execFileSync(tar, ['-a', '-cf', path.join(dir, 'a.zip'), '-C', dir, 'src']);
    fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
    execFileSync(tar, ['-xf', path.join(dir, 'a.zip'), '-C', path.join(dir, 'out')]);
    if (fs.readFileSync(path.join(dir, 'out', 'src', 'hello.txt'), 'utf8') !== 'hi') throw new Error('bad extract');
    return 'ok in ' + dir;
  });

  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(out, 'console.log'), consoleMsgs.join('\n'));
  const table = ['| | Check | Detail |', '|---|---|---|',
    ...results.map((r) => `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${r.detail.replace(/\|/g, '\\|')} |`)].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## RetroRIP Windows checklist\n\n' + table + '\n');
  console.log('\n' + table);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
