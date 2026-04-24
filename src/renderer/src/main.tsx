import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CornersOut,
  FastForward,
  GearSix,
  Heart,
  MagnifyingGlass,
  MusicNoteSimple,
  Pause,
  Play,
  Plus,
  Question,
  Repeat,
  Rewind,
  Shuffle,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerSlash,
  ThumbsDown,
  Trash,
  Warning,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react';
import './style.css';
import type { AppSettings, PlayerState, ProbeResult, QueueItem, SearchHit, ServerProfile, SongInfo } from './types';

const api = window.remoteYoutube;
const DEFAULT_SETTINGS: AppSettings = {
  servers: [{ id: 'local-default', alias: 'Local Studio', baseUrl: 'http://127.0.0.1:26538', token: '' }],
  activeServerId: 'local-default',
  pollMs: 2500,
};
const DEFAULT_PLAYER_STATE: PlayerState = {
  volume: { state: 70, isMuted: false },
  like: { state: null },
  shuffle: { state: null },
  repeat: { mode: null },
  fullscreen: { state: false },
  nextSong: null,
};

function formatTime(seconds?: number) {
  const safe = Math.max(0, Number(seconds || 0));
  const hour = Math.floor(safe / 3600);
  const min = Math.floor((safe % 3600) / 60);
  const sec = Math.floor(safe % 60);
  if (hour > 0) return `${hour}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function readVolumeState(volumeState: PlayerState['volume']) {
  const data = volumeState as any;
  const raw = data?.state ?? data?.volume ?? data?.value ?? data?.level;
  const value = Number(raw);
  return Number.isFinite(value) ? clampPercent(value) : null;
}

function createServer(): ServerProfile {
  const id = `server-${Date.now()}`;
  return { id, alias: 'New Remote', baseUrl: 'http://127.0.0.1:26538', token: '' };
}

function nextSongTitle(nextSong: unknown) {
  const data = nextSong as any;
  if (!data) return '';
  const runs = data?.title?.runs?.map((run: any) => run?.text || '').join('');
  return data.title || runs || data?.title?.simpleText || '';
}

function isLiked(state: PlayerState) {
  return String(state.like.state || '').toUpperCase() === 'LIKE';
}

function isDisliked(state: PlayerState) {
  return String(state.like.state || '').toUpperCase() === 'DISLIKE';
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [probe, setProbe] = useState<ProbeResult>({ ok: false, status: 'offline' });
  const [song, setSong] = useState<SongInfo | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>(DEFAULT_PLAYER_STATE);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform>('linux');
  const [volume, setVolume] = useState(70);
  const [isVolumeEditing, setIsVolumeEditing] = useState(false);
  const [showVolumeTip, setShowVolumeTip] = useState(false);
  const [seekSeconds] = useState(10);
  const volumeRef = useRef(volume);
  const isVolumeEditingRef = useRef(false);
  const hasLocalVolumeRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const volumeTipTimerRef = useRef<number | null>(null);

  const activeServer = useMemo(
    () => settings.servers.find((server) => server.id === settings.activeServerId) || settings.servers[0],
    [settings],
  );

  const progress = useMemo(() => {
    if (!song?.songDuration) return 0;
    return Math.min(100, Math.max(0, ((song.elapsedSeconds || 0) / song.songDuration) * 100));
  }, [song]);

  async function refresh(silent = false) {
    try {
      if (!silent) setBusy(true);
      const status = await api.probe();
      setProbe(status);
      if (status.ok) {
        const [now, nextState, nextQueue] = await Promise.all([
          api.nowPlaying(),
          api.playerState().catch(() => DEFAULT_PLAYER_STATE),
          api.queue().catch(() => []),
        ]);
        setSong(now);
        setPlayerState(nextState);
        const remoteVolume = readVolumeState(nextState.volume);
        if (remoteVolume !== null && !isVolumeEditingRef.current && !hasLocalVolumeRef.current) {
          volumeRef.current = remoteVolume;
          setVolume(remoteVolume);
        }
        setQueue(nextQueue);
      } else {
        setSong(null);
        setPlayerState(DEFAULT_PLAYER_STATE);
        setQueue([]);
      }
      setError('');
    } catch (err) {
      setProbe({ ok: false, status: 'offline' });
      setSong(null);
      setPlayerState(DEFAULT_PLAYER_STATE);
      setQueue([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function run(action: () => Promise<unknown>, shouldRefresh = true) {
    try {
      setBusy(true);
      setError('');
      await action();
      if (shouldRefresh) await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function syncSoon(delayMs = 450) {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      refresh(true);
    }, delayMs);
  }

  function revealVolumeTip(autoHide = false) {
    if (volumeTipTimerRef.current) window.clearTimeout(volumeTipTimerRef.current);
    setShowVolumeTip(true);
    if (autoHide) {
      volumeTipTimerRef.current = window.setTimeout(() => {
        volumeTipTimerRef.current = null;
        setShowVolumeTip(false);
      }, 900);
    }
  }

  async function search() {
    if (!query.trim()) return;
    await run(async () => {
      setHits(await api.search(query, 8));
    }, false);
  }

  async function switchServer(serverId: string) {
    await run(async () => {
      const saved = await api.saveSettings({ activeServerId: serverId });
      setSettings(saved);
      setDraft(saved);
      setHits([]);
    });
  }

  function updateDraftServer(id: string, patch: Partial<ServerProfile>) {
    setDraft((current) => ({
      ...current,
      servers: current.servers.map((server) => (server.id === id ? { ...server, ...patch } : server)),
    }));
  }

  function addDraftServer() {
    const next = createServer();
    setDraft((current) => ({ ...current, servers: [...current.servers, next], activeServerId: next.id }));
  }

  function removeDraftServer(id: string) {
    setDraft((current) => {
      const servers = current.servers.filter((server) => server.id !== id);
      const safeServers = servers.length ? servers : [createServer()];
      return {
        ...current,
        servers: safeServers,
        activeServerId: safeServers.some((server) => server.id === current.activeServerId) ? current.activeServerId : safeServers[0].id,
      };
    });
  }

  async function saveDraftSettings() {
    await run(async () => {
      const saved = await api.saveSettings(draft);
      setSettings(saved);
      setDraft(saved);
      setShowSettings(false);
      setHits([]);
    });
  }

  function seekFromProgress(event: React.MouseEvent<HTMLDivElement>) {
    if (!song?.songDuration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const seconds = Math.round(song.songDuration * ratio);
    setSong({ ...song, elapsedSeconds: seconds });
    run(() => api.control('seekTo', { seconds }), false).then(() => syncSoon());
  }

  function changeVolume(value: number) {
    const nextVolume = clampPercent(value);
    hasLocalVolumeRef.current = true;
    volumeRef.current = nextVolume;
    setVolume(nextVolume);
    revealVolumeTip();
  }

  function commitVolume(value = volumeRef.current) {
    const nextVolume = clampPercent(value);
    hasLocalVolumeRef.current = true;
    volumeRef.current = nextVolume;
    setVolume(nextVolume);
    setIsVolumeEditing(false);
    isVolumeEditingRef.current = false;
    revealVolumeTip(true);
    setPlayerState((current) => ({ ...current, volume: { ...current.volume, state: nextVolume } }));
    run(() => api.control('volume', { volume: nextVolume }), false).then(() => syncSoon(550));
  }

  async function playHit(hit: SearchHit) {
    await run(() => api.playVideo(hit.videoId));
    setHits([]);
    setQuery('');
  }

  async function queueHit(hit: SearchHit) {
    await run(() => api.addToQueue(hit.videoId, false));
    setHits([]);
  }

  useEffect(() => {
    api.platform().then(setPlatform).catch(() => setPlatform('linux'));
    api.getSettings().then((loaded) => {
      setSettings(loaded);
      setDraft(loaded);
    }).then(() => refresh());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => refresh(true), Math.max(1000, settings.pollMs || 2500));
    return () => window.clearInterval(id);
  }, [settings.pollMs, settings.activeServerId]);

  useEffect(() => {
    hasLocalVolumeRef.current = false;
  }, [settings.activeServerId]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isVolumeEditingRef.current = isVolumeEditing;
  }, [isVolumeEditing]);

  useEffect(() => () => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    if (volumeTipTimerRef.current) window.clearTimeout(volumeTipTimerRef.current);
  }, []);

  const stateLabel = probe.status === 'connected' ? 'Connected' : probe.status === 'needs-auth' ? 'Auth required' : 'Offline';
  const isPlaying = song && !song.isPaused;
  const nextTitle = nextSongTitle(playerState.nextSong);

  return (
    <main className="app-shell">
      <div className="window-chrome">
        <div className="window-title">Remote YouTube CTL</div>
        {platform !== 'darwin' && (
          <div className="window-controls">
            <button onClick={() => api.windowMinimize()} aria-label="Minimize" />
            <button onClick={() => api.windowMaximizeToggle()} aria-label="Maximize" />
            <button className="close" onClick={() => api.windowClose()} aria-label="Close" />
          </div>
        )}
      </div>
      <aside className="remote-sidebar">
        <div className="app-brand">
          <div className="brand-mark"><YoutubeLogo size={20} weight="fill" /></div>
          <div><strong>Remote</strong><span>YouTube CTL</span></div>
        </div>
        <button className="nav-pill active"><span className="nav-dot" />Remotes</button>
        <button className="nav-pill" onClick={() => setShowHelp(true)}><Question size={18} />Help</button>
        <button className="nav-pill" onClick={() => setShowSettings(true)}><GearSix size={18} />Settings</button>
        <div className="sidebar-divider" />
        <button className="new-remote" onClick={() => { setDraft(settings); addDraftServer(); setShowSettings(true); }}><Plus size={18} />New remote</button>
        <div className="remote-list">
          {settings.servers.map((server) => (
            <button key={server.id} className={server.id === settings.activeServerId ? 'remote-card active' : 'remote-card'} onClick={() => switchServer(server.id)}>
              <span className={`status-dot ${server.id === settings.activeServerId ? probe.status : ''}`} />
              <strong>{server.alias}</strong>
              <small>{server.baseUrl.replace(/^https?:\/\//, '')}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="main-stage">
        <header className="top-bar">
          <div className="search-wrap">
            <form onSubmit={(event) => { event.preventDefault(); search(); }} className="global-search">
              <MagnifyingGlass size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, albums, artists" />
            </form>
            {hits.length > 0 && (
              <div className="search-popover">
                {hits.map((hit) => (
                  <article className="search-hit" key={hit.videoId}>
                    <div className="thumb small-thumb">{hit.thumbnailUrl ? <img src={hit.thumbnailUrl} alt="Search result thumbnail" /> : <MusicNoteSimple size={18} />}</div>
                    <div><strong>{hit.title}</strong><span>{hit.artist || 'Unknown artist'}{hit.album ? ` · ${hit.album}` : ''}</span></div>
                    <button onClick={() => playHit(hit)}><Play size={15} weight="fill" /></button>
                    <button onClick={() => queueHit(hit)}><Plus size={15} /></button>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className={`connection-chip ${probe.status}`}><span className="status-dot" />{stateLabel}<strong>{activeServer?.alias}</strong></div>
        </header>

        {error && <div className="error-box"><Warning size={18} />{error}</div>}

        <div className="media-canvas">
          <div className="media-frame">
            {song?.imageSrc ? <img src={song.imageSrc} alt="Current track thumbnail" /> : <MusicNoteSimple size={96} weight="fill" />}
            <div className="media-glow" />
          </div>
          <div className="media-caption">
            <p>{isPlaying ? 'Streaming on remote' : 'Remote player idle'}</p>
            <h1>{song?.title || 'No track selected'}</h1>
            <span>{song?.artist || 'Search and send a track to the selected remote.'}</span>
          </div>
        </div>
      </section>

      <aside className="side-panel">
        {busy && <div className="skeleton-stack"><span /><span /><span /></div>}
        <div className="queue-panel compact-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Remote lineup</p><h2>Up next</h2></div>
            <div className="panel-actions"><button onClick={() => refresh()}><Repeat size={15} /></button><button onClick={() => run(() => api.control('clearQueue'))}><Trash size={15} /></button></div>
          </div>
          <div className="queue-list">
            {queue.slice(0, 28).map((item) => (
              <div className={item.selected ? 'queue-item selected' : 'queue-item'} key={`${item.index}-${item.videoId}`}>
                <button className="queue-main" onClick={() => run(() => api.jumpQueue(item.index))}>
                  <span>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="Queue item thumbnail" /> : item.index + 1}</span>
                  <strong>{item.title || 'Queue item'}</strong>
                  <em>{item.artist}</em>
                </button>
                <button className="queue-remove" onClick={() => run(() => api.control('removeQueue', { index: item.index }))} aria-label="Remove queue item"><X size={14} /></button>
              </div>
            ))}
            {queue.length === 0 && <div className="empty-state compact">No queue data from the selected remote.</div>}
          </div>
        </div>
      </aside>

      <footer className="player-bar">
        <div className="bar-controls">
          <button onClick={() => run(() => api.control('previous'))}><SkipBack size={20} weight="fill" /></button>
          <button className="play-button" onClick={() => run(() => api.control(isPlaying ? 'pause' : 'play'))}>{isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}</button>
          <button onClick={() => run(() => api.control('next'))}><SkipForward size={20} weight="fill" /></button>
          <span>{formatTime(song?.elapsedSeconds)}</span>
          <div className="progress-line interactive" onClick={seekFromProgress}><span style={{ width: `${progress}%` }} /></div>
          <span>{formatTime(song?.songDuration)}</span>
        </div>
        <div className="bar-track">
          <div className="bar-thumb">{song?.imageSrc ? <img src={song.imageSrc} alt="Current track thumbnail" /> : <MusicNoteSimple size={24} />}</div>
          <div className="bar-meta"><strong>{song?.title || 'No track playing'}</strong><span>{song?.artist || activeServer?.alias || 'Remote'}</span></div>
        </div>
        <div className="bar-actions">
          <button onClick={() => run(() => api.control('seekBack', { seconds: seekSeconds }))}><Rewind size={18} /></button>
          <button onClick={() => run(() => api.control('seekForward', { seconds: seekSeconds }))}><FastForward size={18} /></button>
          <button className={isLiked(playerState) ? 'active' : ''} onClick={() => run(() => api.control('like'))}><Heart size={19} weight="fill" /></button>
          <button className={isDisliked(playerState) ? 'active' : ''} onClick={() => run(() => api.control('dislike'))}><ThumbsDown size={19} /></button>
          <button className={playerState.shuffle.state ? 'active' : ''} onClick={() => run(() => api.control('shuffle'))}><Shuffle size={18} /></button>
          <button className={playerState.repeat.mode && playerState.repeat.mode !== 'NONE' ? 'active' : ''} onClick={() => run(() => api.control('switchRepeat', { iteration: 1 }))}><Repeat size={18} /></button>
          <button className={playerState.volume.isMuted ? 'active' : ''} onClick={() => run(() => api.control('toggleMute'))}>{playerState.volume.isMuted ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}</button>
          <div
            className={showVolumeTip || isVolumeEditing ? 'volume-control show-tip' : 'volume-control'}
            style={{ '--volume-ratio': `${volume}%` } as React.CSSProperties}
            onPointerEnter={() => setShowVolumeTip(true)}
            onPointerLeave={() => {
              if (!isVolumeEditingRef.current) setShowVolumeTip(false);
            }}
          >
            <span className="volume-tip">{volume}%</span>
            <input
              className="volume-slider"
              type="range"
              min="0"
              max="100"
              value={volume}
              onPointerDown={() => {
                isVolumeEditingRef.current = true;
                setIsVolumeEditing(true);
                revealVolumeTip();
              }}
              onChange={(event) => changeVolume(Number(event.currentTarget.value))}
              onPointerUp={(event) => commitVolume(Number(event.currentTarget.value))}
              onPointerCancel={(event) => commitVolume(Number(event.currentTarget.value))}
              onBlur={(event) => {
                if (isVolumeEditingRef.current) commitVolume(Number(event.currentTarget.value));
                setShowVolumeTip(false);
              }}
              onKeyDown={() => revealVolumeTip()}
              onKeyUp={(event) => commitVolume(Number(event.currentTarget.value))}
            />
          </div>
          <button className={playerState.fullscreen.state ? 'active' : ''} onClick={() => run(() => api.control('fullscreen', { state: !playerState.fullscreen.state }))}><CornersOut size={18} /></button>
        </div>
      </footer>

      {nextTitle && <div className="next-toast"><span>Next</span>{nextTitle}</div>}

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <section className="settings-modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title-row"><div><p className="eyebrow">Connections</p><h2>Remote servers</h2></div><button onClick={addDraftServer}><Plus size={16} />Add remote</button></div>
            <div className="server-editor-list">
              {draft.servers.map((server) => (
                <article className={server.id === draft.activeServerId ? 'server-editor active' : 'server-editor'} key={server.id}>
                  <div className="server-editor-head"><button className="select-server" onClick={() => setDraft({ ...draft, activeServerId: server.id })}>{server.id === draft.activeServerId ? 'Active' : 'Use this'}</button><button onClick={() => removeDraftServer(server.id)}>Remove</button></div>
                  <label>Alias<input value={server.alias} onChange={(event) => updateDraftServer(server.id, { alias: event.target.value })} /></label>
                  <label>API base URL<input value={server.baseUrl} onChange={(event) => updateDraftServer(server.id, { baseUrl: event.target.value })} /></label>
                  <label>Bearer token<input value={server.token} onChange={(event) => updateDraftServer(server.id, { token: event.target.value })} placeholder="Only needed when auth is enabled" /></label>
                </article>
              ))}
            </div>
            <label>Polling ms<input type="number" min="1000" value={draft.pollMs} onChange={(event) => setDraft({ ...draft, pollMs: Number(event.target.value) })} /></label>
            <div className="modal-actions"><button onClick={() => { setDraft(settings); setShowSettings(false); }}>Cancel</button><button className="primary-action" onClick={saveDraftSettings}>Save</button></div>
          </section>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section className="settings-modal help-modal" onClick={(event) => event.stopPropagation()}>
            <div><p className="eyebrow">Help</p><h2>Pear Desktop API setup</h2></div>
            <ol className="help-steps">
              <li>Pear Desktop을 설치하고 YouTube Music 계정으로 로그인합니다.</li>
              <li>앱 설정에서 플러그인 또는 Extensions 메뉴를 열고 `api-server` 플러그인을 활성화합니다.</li>
              <li>기본 포트는 `26538`입니다. 같은 컴퓨터면 `http://127.0.0.1:26538`을 사용합니다.</li>
              <li>다른 컴퓨터에서 제어하려면 방화벽과 네트워크 접근을 허용하고, 서버 주소를 `http://host-ip:26538` 형태로 등록합니다.</li>
              <li>인증 방식이 `AUTH_AT_FIRST`라면 Pear Desktop에서 승인 후 받은 bearer token을 서버 설정에 입력합니다. 인증이 `NONE`이면 token은 비워둡니다.</li>
              <li>여러 서버를 등록한 뒤 왼쪽 sidebar에서 제어 대상을 전환합니다.</li>
            </ol>
            <div className="modal-actions"><button className="primary-action" onClick={() => setShowHelp(false)}>Close</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
