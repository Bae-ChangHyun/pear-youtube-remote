const assert = require('node:assert/strict');
const test = require('node:test');
const { extractSearchHits, getVideoId, isSelected, queueItemSummary, thumbnailUrl } = require('../src/main/pearPayloads.cjs');

test('reads queue renderer variants', () => {
  const item = {
    playlistPanelVideoWrapperRenderer: {
      primaryRenderer: {
        playlistPanelVideoRenderer: {
          selected: true,
          videoId: 'abc123',
          title: { runs: [{ text: 'Track' }, { text: ' One' }] },
          longBylineText: { simpleText: 'Artist' },
          thumbnail: { thumbnails: [{ url: '//img.example/1.jpg' }] },
        },
      },
    },
  };

  assert.equal(getVideoId(item), 'abc123');
  assert.equal(isSelected(item), true);
  assert.deepEqual(queueItemSummary(item, 2), {
    index: 2,
    videoId: 'abc123',
    selected: true,
    title: 'Track One',
    artist: 'Artist',
    thumbnailUrl: 'https://img.example/1.jpg',
    raw: item,
  });
});

test('normalizes thumbnail protocol-relative URLs', () => {
  assert.equal(thumbnailUrl({ thumbnails: [{ url: '//cdn.example/thumb.jpg' }] }), 'https://cdn.example/thumb.jpg');
});

test('extracts and ranks search hits from YouTube Music renderer trees', () => {
  const payload = {
    contents: [
      {
        musicResponsiveListItemRenderer: {
          flexColumns: [
            { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Live Clip' }] } } },
            { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Video' }, { text: ' • ' }, { text: 'Artist B' }] } } },
          ],
          overlay: { musicItemThumbnailOverlayRenderer: { content: { musicPlayButtonRenderer: { playNavigationEndpoint: { watchEndpoint: { videoId: 'video-hit' } } } } } },
          thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: 'https://img.example/video.jpg' }] } } },
        },
      },
      {
        musicResponsiveListItemRenderer: {
          flexColumns: [
            { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Studio Song' }] } } },
            { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Song' }, { text: ' • ' }, { text: 'Artist A' }, { text: ' • ' }, { text: 'Album A' }] } } },
          ],
          menu: { menuRenderer: { items: [{ menuNavigationItemRenderer: { navigationEndpoint: { watchEndpoint: { videoId: 'song-hit' } } } }] } },
          thumbnail: { musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url: 'https://img.example/song.jpg' }] } } },
        },
      },
    ],
  };

  const hits = extractSearchHits(payload, 2);

  assert.equal(hits.length, 2);
  assert.equal(hits[0].videoId, 'song-hit');
  assert.equal(hits[0].title, 'Studio Song');
  assert.equal(hits[1].videoId, 'video-hit');
});
