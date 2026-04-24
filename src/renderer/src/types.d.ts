export type PlayerStatus = 'connected' | 'needs-auth' | 'offline';
export type RepeatMode = 'ONE' | 'NONE' | 'ALL' | null;
export type LikeState = 'LIKE' | 'DISLIKE' | 'INDIFFERENT' | string | null;

export interface ServerProfile {
  id: string;
  alias: string;
  baseUrl: string;
  token: string;
}

export interface AppSettings {
  servers: ServerProfile[];
  activeServerId: string;
  pollMs: number;
}

export interface ProbeResult {
  ok: boolean;
  status: PlayerStatus;
  serverId?: string;
  error?: string;
}

export interface SongInfo {
  title?: string;
  alternativeTitle?: string;
  artist?: string;
  artistUrl?: string;
  album?: string | null;
  videoId?: string;
  url?: string;
  imageSrc?: string | null;
  songDuration?: number;
  elapsedSeconds?: number;
  isPaused?: boolean;
  mediaType?: string;
}

export interface SearchHit {
  videoId: string;
  title: string;
  artist: string;
  album: string;
  thumbnailUrl?: string;
}

export interface QueueItem {
  index: number;
  videoId: string;
  selected: boolean;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
  raw: unknown;
}

export interface PlayerState {
  volume: { state: number | null; isMuted: boolean };
  like: { state: LikeState };
  shuffle: { state: boolean | null };
  repeat: { mode: RepeatMode };
  fullscreen: { state: boolean };
  nextSong: unknown | null;
}

export interface RemoteYoutubeApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  openExternal(url: string): Promise<void>;
  platform(): Promise<NodeJS.Platform>;
  windowMinimize(): Promise<void>;
  windowMaximizeToggle(): Promise<void>;
  windowClose(): Promise<void>;
  probe(): Promise<ProbeResult>;
  nowPlaying(): Promise<SongInfo | null>;
  playerState(): Promise<PlayerState>;
  queue(): Promise<QueueItem[]>;
  control(command: string, payload?: Record<string, unknown>): Promise<{ ok: boolean }>;
  search(query: string, limit?: number): Promise<SearchHit[]>;
  addToQueue(videoId: string, atEnd?: boolean): Promise<{ ok: boolean }>;
  jumpQueue(index: number): Promise<{ ok: boolean }>;
  playVideo(videoId: string): Promise<{ ok: boolean; index: number }>;
}

declare global {
  interface Window {
    remoteYoutube: RemoteYoutubeApi;
  }
}
