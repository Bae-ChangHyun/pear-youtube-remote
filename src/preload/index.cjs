const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('remoteYoutube', {
  getSettings: () => invoke('settings:get'),
  saveSettings: (settings) => invoke('settings:save', settings),
  openExternal: (url) => invoke('app:openExternal', url),
  platform: () => invoke('app:platform'),
  windowMinimize: () => invoke('window:minimize'),
  windowMaximizeToggle: () => invoke('window:maximizeToggle'),
  windowClose: () => invoke('window:close'),
  probe: () => invoke('pear:probe'),
  nowPlaying: () => invoke('pear:nowPlaying'),
  playerState: () => invoke('pear:playerState'),
  queue: () => invoke('pear:queue'),
  control: (command, payload) => invoke('pear:control', command, payload),
  search: (query, limit) => invoke('pear:search', query, limit),
  addToQueue: (videoId, atEnd) => invoke('pear:addToQueue', videoId, atEnd),
  jumpQueue: (index) => invoke('pear:jumpQueue', index),
  playVideo: (videoId) => invoke('pear:playVideo', videoId),
});
