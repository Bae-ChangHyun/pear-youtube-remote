const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

const isDev = !app.isPackaged;
const DEFAULT_SERVER = {
  id: 'local-default',
  alias: 'Local Studio',
  baseUrl: 'http://127.0.0.1:26538',
  token: '',
};
const DEFAULT_SETTINGS = {
  servers: [DEFAULT_SERVER],
  activeServerId: DEFAULT_SERVER.id,
  pollMs: 2500,
};
const APP_ICON = path.join(__dirname, '../../assets/icon.png');

let settings = { ...DEFAULT_SETTINGS, servers: [...DEFAULT_SETTINGS.servers] };
let mainWindow = null;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function normalizeServer(server, index = 0) {
  const fallback = index === 0 ? DEFAULT_SERVER : { id: `server-${Date.now()}-${index}`, alias: `Remote ${index + 1}`, baseUrl: DEFAULT_SERVER.baseUrl, token: '' };
  return {
    id: String(server?.id || fallback.id),
    alias: String(server?.alias || fallback.alias),
    baseUrl: String(server?.baseUrl || fallback.baseUrl).replace(/\/$/, ''),
    token: String(server?.token || ''),
  };
}

function normalizeSettings(raw) {
  const legacyServer = raw?.baseUrl ? [{
    id: 'legacy-default',
    alias: raw.alias || 'Local Studio',
    baseUrl: raw.baseUrl,
    token: raw.token || '',
  }] : null;
  const servers = (Array.isArray(raw?.servers) && raw.servers.length ? raw.servers : legacyServer || DEFAULT_SETTINGS.servers).map(normalizeServer);
  const activeServerId = servers.some((s) => s.id === raw?.activeServerId) ? raw.activeServerId : servers[0].id;
  return {
    servers,
    activeServerId,
    pollMs: Number(raw?.pollMs || DEFAULT_SETTINGS.pollMs),
  };
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    settings = normalizeSettings(JSON.parse(raw));
  } catch {
    settings = normalizeSettings(DEFAULT_SETTINGS);
  }
}

async function saveSettings(next) {
  settings = normalizeSettings({ ...settings, ...next });
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2));
  return settings;
}

function activeServer() {
  return settings.servers.find((s) => s.id === settings.activeServerId) || settings.servers[0] || DEFAULT_SERVER;
}

function headers(server, withBody = false) {
  const h = {};
  if (withBody) h['Content-Type'] = 'application/json';
  if (server.token) h.Authorization = `Bearer ${server.token}`;
  return h;
}

async function request(method, endpoint, body, timeoutMs = 2500) {
  const server = activeServer();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${server.baseUrl}${endpoint}`, {
      method,
      headers: headers(server, Boolean(body)),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok && res.status !== 204) {
      const detail = typeof data === 'string' ? data : JSON.stringify(data || {});
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestFirst(candidates, timeoutMs = 2500) {
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return await request(candidate.method, candidate.endpoint, candidate.body, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No API candidates provided.');
}

async function postVoid(endpoint, body) {
  await request('POST', endpoint, body || {});
  return { ok: true };
}

function getVideoId(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.videoId === 'string') return item.videoId;
  const direct = item.playlistPanelVideoRenderer;
  if (direct && typeof direct.videoId === 'string') return direct.videoId;
  const wrapped = item.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
  if (wrapped && typeof wrapped.videoId === 'string') return wrapped.videoId;
  return '';
}

function selectedRenderer(item) {
  if (!item || typeof item !== 'object') return null;
  return item.playlistPanelVideoRenderer || item.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer || item;
}

function isSelected(item) {
  return Boolean(selectedRenderer(item)?.selected);
}

function runsText(node) {
  const runs = Array.isArray(node?.runs) ? node.runs : [];
  return runs.map((r) => r?.text || '').join('').trim();
}

function simpleOrRunsText(node) {
  return runsText(node) || node?.simpleText || '';
}

function thumbnailUrl(node) {
  const thumbnails = node?.thumbnail?.thumbnails || node?.thumbnails || node?.thumbnailRenderer?.thumbnail?.thumbnails;
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  return String(thumbnails.at(-1)?.url || '').replace(/^\/\//, 'https://');
}

function queueItemSummary(item, index) {
  const renderer = selectedRenderer(item) || {};
  return {
    index,
    videoId: getVideoId(item),
    selected: isSelected(item),
    title: simpleOrRunsText(renderer.title) || 'Queue item',
    artist: simpleOrRunsText(renderer.longBylineText) || simpleOrRunsText(renderer.shortBylineText),
    thumbnailUrl: thumbnailUrl(renderer),
    raw: item,
  };
}

function deepFindVideoId(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.videoId === 'string' && node.videoId) return node.videoId;
  for (const child of Object.values(node)) {
    const found = deepFindVideoId(child);
    if (found) return found;
  }
  return '';
}

function deepFindThumbnail(node) {
  if (!node || typeof node !== 'object') return '';
  const foundHere = thumbnailUrl(node);
  if (foundHere) return foundHere;
  for (const child of Object.values(node)) {
    const found = deepFindThumbnail(child);
    if (found) return found;
  }
  return '';
}

function flexColsTyped(item) {
  const cols = Array.isArray(item.flexColumns) ? item.flexColumns : [];
  const colRuns = (col) => {
    const inner = col?.musicResponsiveListItemFlexColumnRenderer || col;
    return Array.isArray(inner?.text?.runs) ? inner.text.runs : [];
  };
  const title = colRuns(cols[0]).map((r) => r?.text || '').join('').trim();
  const texts = colRuns(cols[1]).map((r) => r?.text || '');
  const content = texts.filter((t) => t.trim() && !t.includes('•') && !t.includes('·')).map((t) => t.trim());
  return {
    title,
    type: content[0] || '',
    artist: content[1] || '',
    album: content[2] || '',
  };
}

function typeScore(type) {
  if (['노래', 'Song'].includes(type)) return 10;
  if (['동영상', 'Video'].includes(type)) return 50;
  if (['에피소드', 'Episode'].includes(type)) return 80;
  if (['아티스트', 'Artist', '앨범', 'Album', '플레이리스트', 'Playlist', '스테이션', 'Station'].includes(type)) return 9999;
  return 40;
}

function titlePenalty(title) {
  const lowered = title.toLowerCase();
  return ['가사', 'lyrics', 'cover', 'live', ' mr', 'karaoke', '인스트', 'instrumental', 'acoustic', '커버'].some((w) => lowered.includes(w)) ? 30 : 0;
}

function extractSearchHits(data, limit = 10) {
  const seen = new Set();
  const scored = [];
  const add = (score, videoId, title, artist, album = '', thumb = '') => {
    if (!videoId || !title || seen.has(videoId)) return;
    seen.add(videoId);
    scored.push({ score: score + titlePenalty(title), videoId, title, artist, album, thumbnailUrl: thumb });
  };
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const card = node.musicCardShelfRenderer;
    if (card) {
      const title = runsText(card.title);
      const subtitleRuns = Array.isArray(card.subtitle?.runs) ? card.subtitle.runs : [];
      const content = subtitleRuns.map((r) => r?.text || '').filter((t) => t.trim() && !t.includes('•') && !t.includes('·'));
      add(0, deepFindVideoId(card), title, (content[1] || '').trim(), '', deepFindThumbnail(card));
    }
    const item = node.musicResponsiveListItemRenderer;
    if (item) {
      const videoId = deepFindVideoId(item);
      const meta = flexColsTyped(item);
      add(typeScore(meta.type), videoId, meta.title, meta.artist, meta.album, deepFindThumbnail(item));
      return;
    }
    Object.values(node).forEach(walk);
  };
  walk(data);
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(({ score, ...hit }) => hit);
}

async function songInfo() {
  return requestFirst([
    { method: 'GET', endpoint: '/api/v1/song' },
    { method: 'GET', endpoint: '/api/v1/song-info' },
  ], 1500);
}

async function queueItems() {
  const data = await request('GET', '/api/v1/queue');
  return Array.isArray(data?.items) ? data.items : [];
}

async function jumpToQueueIndex(index) {
  await request('PATCH', '/api/v1/queue', { index: Number(index) });
  return { ok: true };
}

async function safeGet(endpoint, fallback) {
  try {
    return await request('GET', endpoint, undefined, 1400);
  } catch {
    return fallback;
  }
}

async function playerState() {
  const [volume, like, shuffle, repeat, fullscreen, nextSong] = await Promise.all([
    safeGet('/api/v1/volume', { state: null, isMuted: false }),
    safeGet('/api/v1/like-state', { state: null }),
    safeGet('/api/v1/shuffle', { state: null }),
    safeGet('/api/v1/repeat-mode', { mode: null }),
    safeGet('/api/v1/fullscreen', { state: false }),
    safeGet('/api/v1/queue/next', null),
  ]);
  return { volume, like, shuffle, repeat, fullscreen, nextSong };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    icon: APP_ICON,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5187');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:save', async (_event, next) => saveSettings(next));
ipcMain.handle('app:openExternal', (_event, url) => shell.openExternal(url));
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximizeToggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

ipcMain.handle('pear:probe', async () => {
  try {
    await songInfo();
    return { ok: true, status: 'connected', serverId: activeServer().id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('HTTP 401')) return { ok: true, status: 'needs-auth', serverId: activeServer().id };
    return { ok: false, status: 'offline', error: msg, serverId: activeServer().id };
  }
});

ipcMain.handle('pear:nowPlaying', async () => songInfo());
ipcMain.handle('pear:playerState', async () => playerState());
ipcMain.handle('pear:queue', async () => {
  const items = await queueItems();
  return items.map(queueItemSummary);
});
ipcMain.handle('pear:control', async (_event, command, payload = {}) => {
  const map = {
    play: ['POST', '/api/v1/play'],
    pause: ['POST', '/api/v1/pause'],
    toggle: ['POST', '/api/v1/toggle-play'],
    next: ['POST', '/api/v1/next'],
    previous: ['POST', '/api/v1/previous'],
    like: ['POST', '/api/v1/like'],
    dislike: ['POST', '/api/v1/dislike'],
    volume: ['POST', '/api/v1/volume', { volume: Math.max(0, Math.min(100, Number(payload.volume ?? 0))) }],
    seekTo: ['POST', '/api/v1/seek-to', { seconds: Math.max(0, Number(payload.seconds || 0)) }],
    seekForward: ['POST', '/api/v1/go-forward', { seconds: Math.max(1, Number(payload.seconds || 10)) }],
    seekBack: ['POST', '/api/v1/go-back', { seconds: Math.max(1, Number(payload.seconds || 10)) }],
    shuffle: ['POST', '/api/v1/shuffle'],
    switchRepeat: ['POST', '/api/v1/switch-repeat', { iteration: Math.max(1, Number(payload.iteration || 1)) }],
    toggleMute: ['POST', '/api/v1/toggle-mute'],
    fullscreen: ['POST', '/api/v1/fullscreen', { state: Boolean(payload.state) }],
    clearQueue: ['DELETE', '/api/v1/queue'],
    removeQueue: ['DELETE', `/api/v1/queue/${Number(payload.index)}`],
  };
  const target = map[command];
  if (!target) throw new Error(`Unknown command: ${command}`);
  await request(target[0], target[1], target[2]);
  return { ok: true };
});
ipcMain.handle('pear:search', async (_event, query, limit) => {
  const data = await request('POST', '/api/v1/search', { query: String(query || '') }, 7000);
  return extractSearchHits(data, Number(limit || 10));
});
ipcMain.handle('pear:addToQueue', async (_event, videoId, atEnd) => {
  return postVoid('/api/v1/queue', {
    videoId: String(videoId),
    insertPosition: atEnd ? 'INSERT_AT_END' : 'INSERT_AFTER_CURRENT_VIDEO',
  });
});
ipcMain.handle('pear:jumpQueue', async (_event, index) => jumpToQueueIndex(index));
ipcMain.handle('pear:playVideo', async (_event, videoId) => {
  const before = await queueItems();
  const existing = before.map((item, index) => ({ index, videoId: getVideoId(item), selected: isSelected(item) })).filter((x) => x.videoId === videoId);
  const selected = before.findIndex(isSelected);
  let target = existing.find((x) => x.index !== selected)?.index ?? existing[0]?.index;
  if (target === undefined) {
    await postVoid('/api/v1/queue', { videoId, insertPosition: 'INSERT_AFTER_CURRENT_VIDEO' });
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const items = await queueItems();
      const found = items.findIndex((item, index) => getVideoId(item) === videoId && !existing.some((x) => x.index === index));
      if (found >= 0) {
        target = found;
        break;
      }
    }
  }
  if (target === undefined) throw new Error('Inserted song did not appear in queue.');
  await jumpToQueueIndex(target);
  await postVoid('/api/v1/play');
  return { ok: true, index: target };
});

app.whenReady().then(async () => {
  await loadSettings();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
