# SoundSphere REST API (`/api/v1`)

All responses use a consistent JSON envelope:
- Success: `{ "data": { ... }, "meta"?: { "page", "limit", "total", "totalPages" } }`
- Error: `{ "error": { "code": "...", "message": "..." } }`

Protected routes require `Authorization: Bearer <accessToken>` and return `401 UNAUTHORIZED` if missing, invalid, or revoked.

---

## System
- `GET /api/v1/health` — Returns `{ status: "ok", storageBackend, timestamp }`.

## Authentication & Profile
- `POST /api/v1/auth/signup` — Create account (`{ displayName, email, password }`).
- `POST /api/v1/auth/login` — Authenticate (`{ email, password }`).
- `POST /api/v1/auth/logout` *(Auth)* — Revoke current access token.
- `POST /api/v1/auth/forgot-password` — Issue password reset instructions/token (`{ email }`).
- `POST /api/v1/auth/reset-password` — Complete password reset (`{ token, newPassword }`).
- `GET /api/v1/auth/me` *(Auth)* — Fetch authenticated user profile.
- `PATCH /api/v1/auth/me` *(Auth)* — Update display name and default FocusFlow durations.

## Catalog, Discovery & Search
- `GET /api/v1/catalog` — Full catalog snapshot (`artists`, `albums`, `tracks`, `editorialPlaylists`).
- `GET /api/v1/discover` — Featured albums, new releases, trending tracks, editorial playlists, recommended artists.
- `GET /api/v1/songs?q=&genre=&mood=&instrumental=&maxBpm=&page=1&limit=20` — Paginated tracks with filters.
- `GET /api/v1/albums?page=1&limit=20` — Paginated albums.
- `GET /api/v1/albums/:id` — Album details, artist, and tracklist.
- `GET /api/v1/artists?page=1&limit=20` — Paginated artists.
- `GET /api/v1/artists/:id` — Artist bio, discography, and tracks.
- `GET /api/v1/search?q=&type=all|tracks|albums|artists|playlists&page=1&limit=20` — Unified search.

## Audio Streaming & Upload
- `GET /api/v1/tracks/:id/stream` — Returns stream URL and CC0 / CC BY attribution metadata (`404` if unavailable).
- `GET /api/v1/tracks/:id/audio` — Streams audio with HTTP `206 Partial Content` `Range` support.
- `POST /api/v1/audio/upload` *(Auth)* — Validates MIME type, extension, container magic bytes (`WAV`, `MP3`, `OGG`, `FLAC`, `MP4/AAC`), and `MAX_AUDIO_UPLOAD_MB` limit (`413` if oversized).

## Favorites, Playlists, History & Queue *(Auth)*
- `GET /api/v1/favorites?page=1&limit=50`
- `POST /api/v1/favorites/:trackId`
- `DELETE /api/v1/favorites/:trackId`
- `GET /api/v1/playlists?page=1&limit=50`
- `POST /api/v1/playlists`
- `GET /api/v1/playlists/:id` *(Public playlists accessible; private playlists owner-only)*
- `PATCH /api/v1/playlists/:id`
- `DELETE /api/v1/playlists/:id`
- `POST /api/v1/playlists/:id/tracks`
- `PATCH /api/v1/playlists/:id/tracks/reorder`
- `DELETE /api/v1/playlists/:id/tracks/:trackId`
- `GET /api/v1/history?page=1&limit=24`
- `POST /api/v1/history`
- `GET /api/v1/queue`
- `PUT /api/v1/queue`

## FocusFlow *(Auth)*
- `GET /api/v1/focus/sessions?page=1&limit=100`
- `POST /api/v1/focus/sessions`

## MemoryMix *(Auth)*
- `GET /api/v1/memory?q=&tagId=&trackId=&bookmarksOnly=&page=1&limit=50`
- `POST /api/v1/memory` — Creates a private note or deduplicates bookmark at same timestamp second.
- `PATCH /api/v1/memory/:id`
- `DELETE /api/v1/memory/:id`
- `GET /api/v1/memory/bookmarks?trackId=`
- `POST /api/v1/memory/bookmarks`
- `DELETE /api/v1/memory/bookmarks/:id`
- `GET /api/v1/memory/tags`
- `POST /api/v1/memory/tags`
- `DELETE /api/v1/memory/tags/:id`
