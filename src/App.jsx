import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FluentProvider, Button, Input, Text, Title2, Title3,
  Card, ProgressBar, Tooltip, Badge, Dropdown, Option,
  makeStyles, tokens, Field,
  Spinner,
} from '@fluentui/react-components';
import {
  ArrowDownloadRegular, VideoRegular, FolderRegular,
  SettingsRegular,
  PlayRegular, DeleteRegular, Open20Regular,
  CheckmarkCircleRegular, WarningFilled,
  DismissRegular, AddRegular, ArrowSyncRegular, Document20Regular,
  LineHorizontal3Regular, ErrorCircleFilled, ClockRegular,
} from '@fluentui/react-icons';
import { getTheme } from './theme.js';
import appIcon from '../assets/icon.png';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'transparent' },
  titleBar: {
    height: '40px', width: '100%', flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: '10px',
    paddingLeft: '10px', paddingRight: '140px', userSelect: 'none',
  },
  titleGroup: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  bodyRow: { flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 },
  hamburger: {
    width: '32px', height: '32px', minWidth: '32px', borderRadius: '6px',
    border: `1px solid ${tokens.colorBrandStroke1}`, background: 'transparent',
    color: tokens.colorNeutralForeground1, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0,
    ':hover': { backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 18%, ${tokens.colorNeutralBackground1})` },
    ':active': { backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 28%, ${tokens.colorNeutralBackground1})` },
  },
  mainCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  titleIcon: {
    width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
    pointerEvents: 'none',
  },
  emptyQueue: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', width: '100%', minHeight: '160px', padding: '24px 16px',
  },
  emptyDownloads: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', width: '100%', minHeight: 'calc(100vh - 180px)', padding: '24px 16px',
  },
  contentWrap: {
    flex: 1, display: 'flex', overflow: 'hidden',
    padding: '4px 0 0 8px',
  },
  contentCard: {
    flex: 1, overflow: 'auto', minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground2,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px 0 0 0',
    padding: '20px 24px',
  },
  sidebar: {
    display: 'flex', flexDirection: 'column', transition: 'width 0.18s cubic-bezier(0.2,0,0,1)',
    overflow: 'hidden', flexShrink: 0,
  },
  paneHeader: {
    height: '44px', display: 'flex', alignItems: 'center', flexShrink: 0,
    paddingLeft: '12px', paddingRight: '12px',
  },
  sidebarTop: { padding: '2px 8px 6px', display: 'flex', flexDirection: 'column', gap: '2px' },
  sidebarBottom: { padding: '6px 8px 10px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '4px',
    cursor: 'pointer', color: tokens.colorNeutralForeground1, border: 'none', background: 'transparent',
    width: '100%', textAlign: 'left', fontSize: '14px', height: 36, transition: 'background-color 0.12s ease',
    ':hover': { backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 16%, ${tokens.colorNeutralBackground1})` },
  },
  navItemActive: {
    backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 30%, ${tokens.colorNeutralBackground1})`,
    color: tokens.colorNeutralForeground1,
    fontWeight: 600,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tokens.colorBrandBackground} 35%, transparent)`,
    ':hover': { backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 38%, ${tokens.colorNeutralBackground1})` },
  },
  navItemActiveCollapsed: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: 'none',
    ':hover': { backgroundColor: tokens.colorBrandBackgroundHover, color: tokens.colorNeutralForegroundOnBrand },
  },
  navIndicator: {
    width: 3, height: 16, borderRadius: 2, background: tokens.colorBrandBackground,
    position: 'absolute', left: 0,
  },
  navLabel: { whiteSpace: 'nowrap', overflow: 'hidden' },
  content: { background: 'transparent' },
  pageTitle: { display: 'block', marginBottom: '10px' },
  card: { padding: '16px', marginBottom: '12px', backgroundColor: tokens.colorNeutralBackground1 },
  row: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  queueItem: {
    padding: '10px 12px', borderRadius: '6px', marginBottom: '8px',
    backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke2}`,
    ':hover': { border: `1px solid color-mix(in srgb, ${tokens.colorBrandBackground} 45%, transparent)` },
  },
  failedItem: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    cursor: 'help',
    ':hover': { border: `1px solid ${tokens.colorPaletteRedBorder1}` },
  },
  warnIcon: { color: '#C19C00', flexShrink: 0 },
  accentButton: {
    backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 12%, ${tokens.colorNeutralBackground1})`,
    border: `1px solid color-mix(in srgb, ${tokens.colorBrandBackground} 55%, transparent)`,
    color: tokens.colorNeutralForeground1,
    ':hover': {
      backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 22%, ${tokens.colorNeutralBackground1})`,
      border: `1px solid ${tokens.colorBrandStroke1}`,
    },
    ':active': { backgroundColor: `color-mix(in srgb, ${tokens.colorBrandBackground} 30%, ${tokens.colorNeutralBackground1})` },
  },
  libraryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' },
  libraryCard: { padding: '12px' },
  preview: { width: '100%', borderRadius: '6px', marginTop: '8px', maxHeight: 140 },
  fileName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' },
});

const FORMATS = ['mp3', 'mp4', 'avi', 'wav', 'flac'];
const AUDIO_FORMATS = ['mp3', 'wav', 'flac'];
function uid() { return 'j' + Date.now() + Math.random().toString(36).slice(2, 7); }
function friendlyError(raw) {
  if (!raw) return 'Unknown error. Please try again.';
  if (/private/i.test(raw)) {
    return 'This media is private, contact and ask permission first then try downloading again.';
  }
  const lines = String(raw).split('\n').map((l) => l.trim()).filter(Boolean);
  const errLine = [...lines].reverse().find((l) => /error/i.test(l)) || lines[0] || 'Unknown error.';
  return errLine.replace(/^ERROR:\s*/i, '');
}

export default function App() {
  const styles = useStyles();
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState('convert');
  const [collapsed, setCollapsed] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryFolder, setLibraryFolder] = useState('audio');
  const [urlInput, setUrlInput] = useState('');
  const [format, setFormat] = useState('mp3');
  const [quality, setQuality] = useState('high');
  const [tools, setTools] = useState(null);
  const [toolsInstalling, setToolsInstalling] = useState(false);
  const [systemAccent, setSystemAccent] = useState(null);

  const theme = useMemo(
    () => (settings ? getTheme(settings.theme, settings.accent, systemAccent) : getTheme('system', 'system', systemAccent)),
    [settings, systemAccent]
  );

  useEffect(() => {
    window.api.settingsGet().then((s) => {
      setSettings(s);
      setQuality(s.audioQuality || 'high');
    });
    window.api.toolsStatus().then(setTools);
    // "Use system accent" follows the real Windows accent color, live.
    if (window.api.accentGet) window.api.accentGet().then((c) => { if (c) setSystemAccent(c); }).catch(() => {});
    if (window.api.onAccentChanged) window.api.onAccentChanged((c) => { if (c) setSystemAccent(c); });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSettings((x) => (x ? { ...x } : x));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    window.api.onJobProgress((d) => {
      setJobs((prev) => prev.map((j) => (j.id === d.id ? { ...j, progress: d.progress, title: d.title || j.title, status: 'downloading', downloadingSince: j.downloadingSince || Date.now() } : j)));
    });
    window.api.onJobDone((d) => {
      setJobs((prev) => prev.map((j) => (j.id === d.id ? { ...j, progress: 100, status: 'done', title: d.title || j.title } : j)));
    });
    window.api.onJobFailed((d) => {
      setJobs((prev) => prev.map((j) => (j.id === d.id ? { ...j, status: 'failed', error: d.error } : j)));
    });
    window.api.onToolsProgress((d) => {
      setTools((t) => ({ ...(t || {}), [d.tool]: d.status === 'ready' ? 'downloading-done' : d.status === 'missing' ? null : (t && t[d.tool]) || 'installing' }));
      if (d.status === 'ready' || d.status === 'missing' || d.status === 'error') {
        window.api.toolsStatus().then(setTools);
      }
    });
  }, []);

  // Dropping a link (e.g. dragged from the browser) fills the link box.
  useEffect(() => {
    const over = (e) => e.preventDefault();
    const drop = (e) => {
      e.preventDefault();
      const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      const link = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
      if (link) {
        setUrlInput(link);
        setActive('convert');
      }
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const updateSettings = useCallback(async (patch) => {
    const s = await window.api.settingsSet({ ...settings, ...patch });
    setSettings(s);
    return s;
  }, [settings]);

  // Switching between audio and video formats picks that kind's default quality from Settings.
  const chooseFormat = (f) => {
    setFormat(f);
    setQuality(AUDIO_FORMATS.includes(f) ? settings.audioQuality : settings.videoQuality);
  };

  const createJob = (url) => ({
    id: uid(), url, format, quality, status: 'queued', progress: 0,
    title: url, error: null, downloadingSince: null,
  });

  // "+" button: park the pasted link in the queue, do NOT start downloading
  const addToQueue = () => {
    const u = urlInput.trim();
    if (!u) return null;
    const job = createJob(u);
    setJobs((prev) => [job, ...prev]);
    setUrlInput('');
    return job;
  };

  const startJob = async (job) => {
    setJobs((prev) => prev.map((j) => (j.id === job.id
      ? { ...j, status: 'downloading', error: null, downloadingSince: Date.now() }
      : j)));
    let r;
    try {
      r = await window.api.convertStart({ id: job.id, url: job.url, format: job.format, quality: job.quality });
    } catch (e) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'failed', error: String(e && e.message || e) } : j)));
      return;
    }
    if (r && r.started) {
      setJobs((prev) => prev.map((j) => (j.id === job.id
        ? { ...j, status: 'downloading', downloadingSince: j.downloadingSince || Date.now() }
        : j)));
    }
  };

  // Convert button: download everything in the queue, plus a link
  // still sitting in the box gets downloaded right away too
  const handleConvert = async () => {
    const pending = jobs.filter((j) => j.status === 'queued');
    let fresh = null;
    if (urlInput.trim()) {
      fresh = createJob(urlInput.trim());
      setJobs((prev) => [fresh, ...prev]);
      setUrlInput('');
    }
    const toStart = fresh ? [fresh, ...pending] : pending;
    for (const job of toStart) {
      await startJob(job);
    }
  };

  const handleCancel = (id) => {
    window.api.convertCancel(id);
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'cancelled' } : j)));
  };
  const removeJob = (id) => setJobs((prev) => prev.filter((j) => j.id !== id));

  const loadLibrary = useCallback(async () => {
    if (!settings) return;
    const folder = libraryFolder === 'audio' ? settings.audioFolder : settings.videoFolder;
    setLibraryFiles(await window.api.libraryList(folder));
  }, [settings, libraryFolder]);

  useEffect(() => {
    if (active === 'library' && settings) loadLibrary();
  }, [active, settings, loadLibrary]);

  const installTools = async () => {
    setToolsInstalling(true);
    await window.api.toolsEnsure();
    setTools(await window.api.toolsStatus());
    setToolsInstalling(false);
  };

  if (!settings) return <div style={{ padding: 24 }}>Loading…</div>;

  const isDark = settings.theme === 'dark'
    || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const navItems = [
    { key: 'convert', label: 'Convert', icon: <ArrowDownloadRegular /> },
    { key: 'downloads', label: 'Downloads', icon: <VideoRegular /> },
    { key: 'library', label: 'Library', icon: <PlayRegular /> },
  ];

  return (
    <FluentProvider theme={theme} style={{ height: '100%', background: 'transparent' }}>
      <div className={styles.root} style={{ backgroundColor: isDark ? 'rgba(20, 20, 20, 0.80)' : 'rgba(246, 246, 246, 0.95)' }}>
          <div className={`${styles.titleBar} drag`}>
            <div className={styles.titleGroup}>
              <img src={appIcon} alt="" draggable={false} className={styles.titleIcon} />
              <Text weight="semibold" size={300}>RetroRIP</Text>
            </div>
          </div>
          <div className={styles.bodyRow}>
          <div className={styles.sidebar} style={{ width: collapsed ? 48 : 216 }}>
            <div
              className={styles.paneHeader}
              style={{ justifyContent: 'flex-start', paddingLeft: 12, paddingRight: collapsed ? 4 : 12 }}
            >
              <button
                className={`${styles.hamburger} no-drag`}
                onClick={() => setCollapsed((c) => !c)}
                title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              >
                <LineHorizontal3Regular style={{ fontSize: 18 }} />
              </button>
            </div>
            <div className={styles.sidebarTop} style={{ paddingLeft: 12, paddingRight: collapsed ? 4 : 8 }}>
              {navItems.map((n) => (
                <button
                  key={n.key}
                  className={`${styles.navItem} ${active === n.key ? styles.navItemActive : ''} ${active === n.key && collapsed ? styles.navItemActiveCollapsed : ''} no-drag`}
                  onClick={() => setActive(n.key)}
                  style={{ position: 'relative', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '8px 0' : undefined }}
                >
                  {active === n.key && <span className={styles.navIndicator} style={collapsed ? { background: tokens.colorNeutralForegroundOnBrand } : undefined} />}
                  {n.icon}
                  {!collapsed && <span className={styles.navLabel}>{n.label}</span>}
                  {n.key === 'downloads' && jobs.some((j) => j.status === 'downloading') && !collapsed && (
                    <Badge appearance="filled" color="informative" size="small" style={{ marginLeft: 'auto' }}>
                      {jobs.filter((j) => j.status === 'downloading').length}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            <div className={styles.sidebarBottom} style={{ paddingLeft: 12, paddingRight: collapsed ? 4 : 8 }}>
              <button
                className={`${styles.navItem} ${active === 'settings' ? styles.navItemActive : ''} ${active === 'settings' && collapsed ? styles.navItemActiveCollapsed : ''} no-drag`}
                onClick={() => setActive('settings')}
                style={{ position: 'relative', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '8px 0' : undefined }}
              >
                {active === 'settings' && <span className={styles.navIndicator} style={collapsed ? { background: tokens.colorNeutralForegroundOnBrand } : undefined} />}
                <SettingsRegular />
                {!collapsed && <span className={styles.navLabel}>Settings</span>}
              </button>
            </div>
          </div>

          <div className={styles.mainCol}>
          <div className={styles.contentWrap}>
          <div className={styles.contentCard}>
          <div className={styles.content}>
            {active === 'convert' && (
              <ConvertView
                styles={styles} urlInput={urlInput} setUrlInput={setUrlInput}
                format={format} setFormat={chooseFormat} quality={quality} setQuality={setQuality}
                handleConvert={handleConvert} addToQueue={addToQueue} jobs={jobs} handleCancel={handleCancel} removeJob={removeJob}
                tools={tools} onInstallTools={installTools} toolsInstalling={toolsInstalling}
              />
            )}
            {active === 'downloads' && (
              <DownloadsView styles={styles} jobs={jobs} handleCancel={handleCancel} removeJob={removeJob} />
            )}
            {active === 'library' && (
              <LibraryView
                styles={styles} settings={settings} libraryFiles={libraryFiles}
                libraryFolder={libraryFolder} setLibraryFolder={setLibraryFolder} loadLibrary={loadLibrary}
              />
            )}
            {active === 'settings' && (
              <SettingsView
                styles={styles} settings={settings} updateSettings={updateSettings} setSettings={setSettings}
                tools={tools} toolsInstalling={toolsInstalling}
                onInstallTools={installTools}
              />
            )}
          </div>
          </div>
          </div>
          </div>
          </div>
      </div>

    </FluentProvider>
  );
}

function ConvertView({ styles, urlInput, setUrlInput, format, setFormat, quality, setQuality, handleConvert, addToQueue, jobs, handleCancel, removeJob, tools, onInstallTools, toolsInstalling }) {
  const toolsReady = tools && tools.ytdlp;
  const [, setQueueTick] = useState(0);
  useEffect(() => {
    if (!jobs.some((j) => j.status === 'downloading')) return undefined;
    const t = setInterval(() => setQueueTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [jobs]);
  const nowTs = Date.now();
  // Queue shows waiting items. Once a download starts it shows the download
  // icon for 5 seconds, then hands off to the Downloads section.
  const visibleJobs = jobs.filter((j) => {
    if (j.status === 'queued') return true;
    if (j.downloadingSince) return nowTs - j.downloadingSince < 5000;
    return false;
  });
  const pendingCount = jobs.filter((j) => j.status === 'queued').length;
  return (
    <div>
      <Title2 className={styles.pageTitle}>Convert</Title2>
      {!toolsReady && (
        <Card className={styles.card} style={{ borderLeft: `3px solid ${tokens.colorPaletteYellowBorder1}` }}>
          <div className={styles.row}>
            <WarningFilled className={styles.warnIcon} />
            <Text style={{ flex: 1 }}>Download engine (yt-dlp) is not ready. Install components to start converting.</Text>
            <Button appearance="primary" disabled={toolsInstalling} onClick={onInstallTools}>
              {toolsInstalling ? <Spinner size="tiny" /> : null} Install components
            </Button>
          </div>
        </Card>
      )}
      <Card className={styles.card}>
        <Field label="Paste your link here.">
          <div className={styles.row}>
            <Input
              value={urlInput}
              onChange={(_e, d) => setUrlInput(d.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addToQueue(); }}
              placeholder="https://www.youtube.com/watch?v=…"
              style={{ flex: 1, minWidth: 220 }}
            />
            <Tooltip content="Add to queue" relationship="label">
              <Button
                className={styles.accentButton}
                icon={<AddRegular />}
                onClick={addToQueue}
                disabled={!urlInput.trim()}
                aria-label="Add to queue"
              />
            </Tooltip>
          </div>
        </Field>
        <div className={styles.row} style={{ marginTop: 12 }}>
          <Field label="Format">
            <Dropdown value={format.toUpperCase()} onOptionSelect={(_e, d) => setFormat(d.optionValue)}>
              {FORMATS.map((f) => (
                <Option key={f} value={f} text={f.toUpperCase()}>{f.toUpperCase()}</Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Quality">
            <Dropdown value={quality === 'high' ? 'High Quality' : quality === 'medium' ? 'Medium' : 'Low'}
              onOptionSelect={(_e, d) => setQuality(d.optionValue)}>
              <Option value="high" text="High Quality">High Quality</Option>
              <Option value="medium" text="Medium">Medium</Option>
              <Option value="low" text="Low">Low</Option>
            </Dropdown>
          </Field>
          <Button
            appearance="primary"
            icon={<ArrowDownloadRegular />}
            onClick={handleConvert}
            disabled={!urlInput.trim() && pendingCount === 0}
            style={{ marginTop: 22 }}
          >
            Convert
          </Button>
        </div>
      </Card>

      <Title3>Queue</Title3>
      {visibleJobs.length === 0 && (
        <div className={styles.emptyQueue}>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>No items in the queue yet.</Text>
        </div>
      )}
      {visibleJobs.map((j) => (
        <div key={j.id} className={styles.queueItem}>
          <div className={styles.row}>
            <Text weight="semibold" className={styles.fileName} style={{ flex: 1 }}>
              {j.title || j.url}
            </Text>
            <Badge appearance="filled" size="small"
              color={j.status === 'done' ? 'success' : j.status === 'failed' ? 'danger' : j.status === 'cancelled' ? 'warning' : 'informative'}>
              {j.status}
            </Badge>
            {j.status === 'downloading' && (
              <Tooltip content="Downloading — view it in Downloads" relationship="label">
                <span style={{ display: 'flex', flexShrink: 0 }}>
                  <ArrowDownloadRegular style={{ color: tokens.colorBrandBackground, fontSize: 20 }} />
                </span>
              </Tooltip>
            )}
            {j.status === 'downloading' || j.status === 'queued' ? (
              <Button size="small" icon={<DismissRegular />} onClick={() => handleCancel(j.id)}>Cancel</Button>
            ) : (
              <Tooltip content="Remove from queue" relationship="label">
                <Button size="small" icon={<DeleteRegular />} onClick={() => removeJob(j.id)} />
              </Tooltip>
            )}
          </div>
          {j.status === 'downloading' && (
            <ProgressBar value={j.progress / 100} style={{ marginTop: 8 }} />
          )}
          {j.status === 'failed' && (
            <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: 6, display: 'block' }}>
              {friendlyError(j.error)}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}

function DownloadsView({ styles, jobs, handleCancel, removeJob }) {
  // Only downloads that have actually started live here; waiting items stay in the Queue.
  const startedJobs = jobs.filter((j) => j.status !== 'queued');
  if (startedJobs.length === 0) {
    return (
      <div>
        <Title2 className={styles.pageTitle}>Downloads</Title2>
        <div className={styles.emptyDownloads}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            No downloaded files yet. start downloading now!
          </Text>
        </div>
      </div>
    );
  }

  const isActive = (j) => j.status === 'downloading' || j.status === 'queued';
  const ordered = [...startedJobs.filter(isActive), ...startedJobs.filter((j) => !isActive(j))];
  const counts = [
    ['in progress', startedJobs.filter(isActive).length],
    ['completed', startedJobs.filter((j) => j.status === 'done').length],
    ['failed', startedJobs.filter((j) => j.status === 'failed').length],
    ['cancelled', startedJobs.filter((j) => j.status === 'cancelled').length],
  ].filter(([, n]) => n > 0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title2 className={styles.pageTitle}>Downloads</Title2>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
          {counts.map(([label, n]) => `${n} ${label}`).join('  ·  ')}
        </Text>
      </div>

      {ordered.map((j) => {
        const statusText = j.status === 'done' ? 'Completed'
          : j.status === 'failed' ? 'Failed'
          : j.status === 'downloading' ? 'Downloading'
          : j.status === 'queued' ? 'In queue'
          : 'Cancelled';
        return (
          <div key={j.id} className={`${styles.queueItem} ${j.status === 'failed' ? styles.failedItem : ''}`}>
            <div className={styles.row}>
              {j.status === 'done' && (
                <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1, fontSize: 20, flexShrink: 0 }} />
              )}
              {j.status === 'failed' && (
                <Document20Regular style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
              )}
              {j.status === 'downloading' && <Spinner size="tiny" />}
              {j.status === 'queued' && (
                <ClockRegular style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
              )}
              {j.status === 'cancelled' && (
                <DismissRegular style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" className={styles.fileName} style={{ display: 'block' }}>
                  {j.title || j.url}
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 2 }}>
                  {(j.format || 'file').toUpperCase()} · {statusText}
                </Text>
              </div>

              {j.status === 'done' && (
                <Badge appearance="filled" color="success" size="small">Done</Badge>
              )}
              {j.status === 'failed' && (
                <Tooltip
                  content={<span style={{ whiteSpace: 'pre-wrap', maxWidth: 420, display: 'block' }}>{friendlyError(j.error)}</span>}
                  relationship="label"
                >
                  <span style={{ display: 'flex', cursor: 'help', flexShrink: 0 }} tabIndex={0}>
                    <ErrorCircleFilled style={{ color: tokens.colorPaletteRedForeground1, fontSize: 22 }} />
                  </span>
                </Tooltip>
              )}
              {j.status === 'downloading' && (
                <Badge appearance="filled" color="informative" size="small">{Math.round(j.progress)}%</Badge>
              )}
              {j.status === 'queued' && (
                <Badge appearance="filled" color="informative" size="small">Queued</Badge>
              )}
              {j.status === 'cancelled' && (
                <Badge appearance="filled" color="warning" size="small">Cancelled</Badge>
              )}

              {isActive(j) ? (
                <Button size="small" icon={<DismissRegular />} onClick={() => handleCancel(j.id)}>Cancel</Button>
              ) : (
                <Tooltip content="Remove" relationship="label">
                  <Button size="small" icon={<DeleteRegular />} onClick={() => removeJob(j.id)} />
                </Tooltip>
              )}
            </div>

            {isActive(j) && (
              <div className={styles.row} style={{ marginTop: 8 }}>
                <ProgressBar
                  value={j.status === 'queued' ? undefined : Math.max(0, Math.min(1, j.progress / 100))}
                  style={{ flex: 1 }}
                />
                <Text size={200}>{j.status === 'queued' ? 'Waiting…' : `${Math.round(j.progress)}%`}</Text>
              </div>
            )}

            {j.status === 'failed' && (
              <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: 6, display: 'block' }}>
                {/private/i.test(j.error || '')
                  ? 'This media is private, contact and ask permission first then try downloading again.'
                  : 'Download failed — hover the red icon for details.'}
              </Text>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LibraryView({ styles, settings, libraryFiles, libraryFolder, setLibraryFolder, loadLibrary }) {
  const folder = libraryFolder === 'audio' ? settings.audioFolder : settings.videoFolder;
  return (
    <div>
      <Title2 className={styles.pageTitle}>Library</Title2>
      <div className={styles.row} style={{ marginBottom: 14 }}>
        <Dropdown
          value={libraryFolder === 'audio' ? 'Audio' : 'Video'}
          onOptionSelect={(_e, d) => setLibraryFolder(d.optionValue)}
          style={{ width: 130 }}
        >
          <Option value="audio" text="Audio">Audio</Option>
          <Option value="video" text="Video">Video</Option>
        </Dropdown>
        <Button className={styles.accentButton} icon={<ArrowSyncRegular />} onClick={loadLibrary}>Refresh</Button>
        <Button className={styles.accentButton} icon={<Open20Regular />} onClick={() => window.api.openPath(folder)}>Open Folder</Button>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{folder}</Text>
      </div>
      <div className={styles.libraryGrid}>
        {libraryFiles.map((f) => {
          const isVideo = ['.mp4', '.avi', '.webm', '.mov', '.mkv'].includes(f.ext);
          return (
            <Card key={f.path} className={styles.libraryCard}>
              <div className={styles.row}>
                <Document20Regular />
                <Text weight="semibold" size={300} className={styles.fileName} style={{ flex: 1 }}>{f.name}</Text>
              </div>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {(f.size / 1024 / 1024).toFixed(2)} MB · {new Date(f.mtime).toLocaleDateString()}
              </Text>
              {isVideo ? (
                <video controls className={styles.preview} src={f.url} preload="metadata" />
              ) : (
                <audio controls className={styles.preview} src={f.url} preload="metadata" />
              )}
              <div className={styles.row} style={{ marginTop: 8 }}>
                <Tooltip content="Open file" relationship="label">
                  <Button className={styles.accentButton} size="small" icon={<PlayRegular />} onClick={() => window.api.openPath(f.path)} />
                </Tooltip>
                <Tooltip content="Show in folder" relationship="label">
                  <Button size="small" icon={<FolderRegular />}
                    onClick={() => window.api.showItem(f.path)} />
                </Tooltip>
                <Tooltip content="Delete file" relationship="label">
                  <Button size="small" icon={<DeleteRegular />} onClick={async () => {
                    if (confirm('Delete this file?\n' + f.name)) {
                      await window.api.deleteFile(f.path);
                      loadLibrary();
                    }
                  }} />
                </Tooltip>
              </div>
            </Card>
          );
        })}
      </div>
      {libraryFiles.length === 0 && <Text style={{ color: tokens.colorNeutralForeground3 }}>No files found in this folder.</Text>}
    </div>
  );
}

function SettingsView({ styles, settings, updateSettings, setSettings, tools, toolsInstalling, onInstallTools }) {
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const pick = async (key) => {
    const s = await window.api.pickFolder(key);
    if (s) setSettings(s);
  };
  const updateEngine = async () => {
    setUpdating(true);
    setUpdateMsg('');
    const r = await window.api.toolsUpdate();
    setUpdateMsg(r.message);
    setUpdating(false);
  };

  const themeLabel = settings.theme === 'light' ? 'Light mode' : settings.theme === 'dark' ? 'Dark Mode' : 'System';
  const accentMap = { system: 'Use system accent', red: 'Red', white: 'White', pink: 'Pink', matcha: 'Matcha', purple: 'Purple', blue: 'Blue' };
  const qLabel = (q) => (q === 'high' ? 'High Quality' : q === 'medium' ? 'Medium' : 'Low');

  return (
    <div>
      <Title2 className={styles.pageTitle}>Settings</Title2>

      <Card className={styles.card}>
        <Title3>Storage</Title3>
        <Field label="Default Audio folder">
          <div className={styles.row}>
            <Input value={settings.audioFolder} readOnly style={{ flex: 1 }} contentAfter={null} />
            <Button className={styles.accentButton} onClick={() => pick('audioFolder')}>Browse…</Button>
          </div>
        </Field>
        <Field label="Default Video folder">
          <div className={styles.row}>
            <Input value={settings.videoFolder} readOnly style={{ flex: 1 }} />
            <Button className={styles.accentButton} onClick={() => pick('videoFolder')}>Browse…</Button>
          </div>
        </Field>
      </Card>

      <Card className={styles.card}>
        <Title3>Appearance</Title3>
        <Field label="Theme">
          <Dropdown value={themeLabel} onOptionSelect={(_e, d) => updateSettings({ theme: d.optionValue })} style={{ width: 220 }}>
            <Option value="light" text="Light mode">Light mode</Option>
            <Option value="dark" text="Dark Mode">Dark Mode</Option>
            <Option value="system" text="System">System</Option>
          </Dropdown>
        </Field>
        <Field label="Accent color">
          <Dropdown value={accentMap[settings.accent] || 'Use system accent'}
            onOptionSelect={(_e, d) => updateSettings({ accent: d.optionValue })} style={{ width: 220 }}>
            {Object.entries(accentMap).map(([k, v]) => (
              <Option key={k} value={k} text={v}>{v}</Option>
            ))}
          </Dropdown>
        </Field>
      </Card>

      <Card className={styles.card}>
        <Title3>Download quality</Title3>
        <Field label="Default audio quality">
          <Dropdown value={qLabel(settings.audioQuality)}
            onOptionSelect={(_e, d) => updateSettings({ audioQuality: d.optionValue })} style={{ width: 220 }}>
            <Option value="high" text="High Quality">High Quality</Option>
            <Option value="medium" text="Medium">Medium</Option>
            <Option value="low" text="Low">Low</Option>
          </Dropdown>
        </Field>
        <Field label="Default video quality">
          <Dropdown value={qLabel(settings.videoQuality)}
            onOptionSelect={(_e, d) => updateSettings({ videoQuality: d.optionValue })} style={{ width: 220 }}>
            <Option value="high" text="High Quality">High Quality</Option>
            <Option value="medium" text="Medium">Medium</Option>
            <Option value="low" text="Low">Low</Option>
          </Dropdown>
        </Field>
      </Card>

      <Card className={styles.card}>
        <Title3>Download engine</Title3>
        <div className={styles.row} style={{ marginTop: 6 }}>
          <Badge appearance="filled" size="small" color={tools && tools.ytdlp ? 'success' : 'danger'}>
            yt-dlp {tools && tools.ytdlp ? 'ready' : 'missing'}
          </Badge>
          <Badge appearance="filled" size="small" color={tools && tools.ffmpeg ? 'success' : 'warning'}>
            ffmpeg {tools && tools.ffmpeg ? 'ready' : 'missing'}
          </Badge>
          <Button appearance="primary" icon={<ArrowSyncRegular />} disabled={toolsInstalling} onClick={onInstallTools}>
            {toolsInstalling ? 'Installing…' : 'Install components'}
          </Button>
          <Button className={styles.accentButton} disabled={!(tools && tools.ytdlp) || updating || toolsInstalling} onClick={updateEngine}>
            {updating ? 'Checking…' : 'Update yt-dlp'}
          </Button>
        </div>
        {updateMsg && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block', marginTop: 8 }}>{updateMsg}</Text>
        )}
      </Card>

      <Card className={styles.card}>
        <Title3>About</Title3>
        <div className={styles.row} style={{ marginTop: 10 }}>
          <img src={appIcon} alt="" draggable={false} style={{ width: 32, height: 32, borderRadius: 7 }} />
          <Text weight="semibold" size={400}>RetroRIP</Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>v1.1</Text>
        </div>
        <Text style={{ display: 'block', marginTop: 8 }}>
          Made by Mr KNIGHT
        </Text>
        <Text style={{ display: 'block' }}>
          Made possible with AI tools.
        </Text>
        <Text style={{ display: 'block' }}>
          October 2026
        </Text>
      </Card>
    </div>
  );
}
