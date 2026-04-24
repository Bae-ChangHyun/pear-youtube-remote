# API Reference

This app controls Pear Desktop's `api-server` plugin. The default remote URL is `http://127.0.0.1:26538`.

## Current Implementation

The client prefers the modern endpoints and falls back where needed:

- `GET /api/v1/song`: current song metadata, including `imageSrc` when available.
- `GET /api/v1/song-info`: deprecated fallback for older servers.
- `GET /api/v1/queue`: queue data.
- `GET /api/v1/queue/next`: next song preview, when supported.
- `POST /api/v1/search`: search YouTube Music.

## Transport Controls

- `POST /api/v1/play`
- `POST /api/v1/pause`
- `POST /api/v1/toggle-play`
- `POST /api/v1/previous`
- `POST /api/v1/next`
- `POST /api/v1/go-back` with `{ "seconds": number }`
- `POST /api/v1/go-forward` with `{ "seconds": number }`
- `POST /api/v1/seek-to` with `{ "seconds": number }`

## Mode And Player State

- `GET /api/v1/volume`
- `POST /api/v1/volume` with `{ "volume": 0..100 }`
- `POST /api/v1/toggle-mute`
- `GET /api/v1/like-state`
- `POST /api/v1/like`
- `POST /api/v1/dislike`
- `GET /api/v1/shuffle`
- `POST /api/v1/shuffle`
- `GET /api/v1/repeat-mode`
- `POST /api/v1/switch-repeat` with `{ "iteration": number }`
- `GET /api/v1/fullscreen`
- `POST /api/v1/fullscreen` with `{ "state": boolean }`

## Queue Controls

- `POST /api/v1/queue` with `{ "videoId": string, "insertPosition": "INSERT_AFTER_CURRENT_VIDEO" | "INSERT_AT_END" }`
- `PATCH /api/v1/queue` with `{ "index": number }`
- `PATCH /api/v1/queue/{index}` with `{ "toIndex": number }`
- `DELETE /api/v1/queue/{index}`
- `DELETE /api/v1/queue`

## Search Ranking

Search responses are YouTube Music renderer trees. The app ranks results by:

- Prefer `musicCardShelfRenderer` top result.
- Prefer `musicResponsiveListItemRenderer` items typed as `Song` / `노래`.
- Demote videos, podcast episodes, lyric videos, covers, karaoke, instrumentals, live, and acoustic variants.
- Preserve thumbnail URLs when present in the search response.

## Thumbnails And Lyrics

- Current-song thumbnails come from `imageSrc` in `/api/v1/song`.
- Search and queue thumbnails are extracted from YouTube Music renderer thumbnail arrays.
- Lyrics are not exposed through the public `api-server` routes used by this app.

## Auth

Pear Desktop can be configured with no auth, or `AUTH_AT_FIRST`.
If auth is enabled, approve the client in Pear Desktop and paste the returned bearer token into the server profile.
