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

module.exports = {
  extractSearchHits,
  getVideoId,
  isSelected,
  queueItemSummary,
  thumbnailUrl,
};
