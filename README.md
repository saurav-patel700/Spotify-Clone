# SoundSphere

SoundSphere is a full-stack music streaming web application built with React, TypeScript, Express, and PostgreSQL/Supabase. Alongside core music discovery, playlist management, and a singleton HTML5 audio player, SoundSphere introduces two productivity and personal listening features: **FocusFlow** and **MemoryMix**.

---

## Key Features

### Core Music Streaming
- **Authentication & Protected Routes**: Signup, login, logout with JWT token revocation, forgot password, password reset, and persistent authenticated sessions.
- **Discovery & Search**: Featured albums, trending tracks, new releases, recommended playlists, artist recommendations, genre/tempo filtering, and catalog search across songs, albums, artists, and playlists.
- **Global Singleton Audio Player**: Single `HTMLAudioElement` engine with play/pause, next/previous track, seek slider with real-time progress, volume & mute, shuffle, repeat one/all, queue management, and uninterrupted playback across page transitions.
- **Personal Library**: Like/unlike tracks, create/edit/delete playlists, add/remove/reorder songs, and recently played history persisted in the database.
- **Responsive Design**: Adaptive desktop sidebar + player bar, collapsible tablet layout, and mobile mini-player with full-screen playback sheet and bottom navigation.

### FocusFlow (Productivity Mode)
- **5 Productivity Modes**: Deep Work, Study, Relax, Break, and Custom.
- **Timestamp-Accurate Pomodoro Timer**: 25m focus, 5m short break, 50m focus, 10m long break, and custom durations calculated using wall-clock timestamps to remain accurate across inactive browser tabs.
- **Synchronized Music Transitions**: Automatically plays the selected focus playlist on start, switches to the break playlist when a focus block finishes, and provides manual track skipping synchronized with the global player.
- **Session Tracking**: Real persisted total focus minutes, completed sessions, daily history, and 7-day weekly productivity summary.

### MemoryMix (Private Listening Journal)
- **Private Song Notes**: Write, edit, and delete personal notes attached to songs (starts empty for new users).
- **Timestamp Bookmarks**: Pin exact playback positions on the seek bar with automatic duplicate-bookmark handling and one-click playback resumption.
- **Personal Tags & Search**: Create custom tags (with quick-add suggestions such as Motivation, Gym, Travel, Memories, Study), search notes by keyword, filter by tags, and sort by recently added, oldest, or timestamp.
- **Dedicated Song Memory Page**: Album artwork, track & artist details, interactive bookmark timeline, saved timestamps, and attached tags.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Zod, Helmet, CORS, Express Rate Limit, Pino
- **Shared Contracts**: `@soundsphere/shared` (TypeScript types and Zod validation schemas)
- **Database & Auth**: PostgreSQL with Supabase (Row-Level Security) for production; built-in `node:sqlite` fallback for zero-config local development
- **Testing**: Vitest, Supertest, React Testing Library, JSDOM

---

## Project Folder Structure

```text
SoundSphere/
├── package.json                  # Workspace scripts & root configuration
├── .gitignore
├── .env.example                  # Environment variable template
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── docs/
│   ├── API.md                    # REST API endpoint reference
│   └── DATABASE.md               # Database schema, RLS, and seed guide
├── scripts/
│   └── dev.mjs                   # Concurrent dev launcher (server + client)
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── schemas.ts            # Shared Zod validation schemas
│       └── types.ts              # Shared TypeScript interfaces
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed/
│       └── seed.sql
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts              # Server bootstrap & graceful shutdown
│   │   ├── app.ts                # Express app, Helmet, CORS, rate limiting
│   │   ├── config/env.ts         # Zod-validated environment configuration
│   │   ├── data/catalog.ts       # Licensed CC0 / CC BY 4.0 catalog seed data
│   │   ├── db/
│   │   │   ├── repository.ts     # DatabaseRepository interface
│   │   │   ├── sqliteStore.ts    # Local SQLite implementation
│   │   │   └── supabaseStore.ts  # Supabase PostgreSQL implementation
│   │   ├── lib/
│   │   │   ├── audioGenerator.ts # Deterministic WAV stream generator
│   │   │   ├── audioUpload.ts    # Audio MIME, magic-byte & size validation
│   │   │   └── authTokens.ts     # scrypt hashing & HMAC-SHA256 JWT helpers
│   │   ├── middleware/auth.ts    # requireAuth & optionalAuth middleware
│   │   └── routes/v1.ts          # /api/v1 REST endpoints & Range streaming
│   └── tests/
│       └── api.test.ts
└── client/
    ├── index.html
    ├── package.json
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── vite.config.ts
    ├── vitest.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── components/           # Layout, player, queue, cards, modals, auth guard
        ├── lib/                  # apiClient, audioEngine, audioSynth, artwork, formatters
        ├── pages/                # Home, Explore, Search, Library, Playlists, FocusFlow, MemoryMix, Legal, Auth
        ├── stores/               # Auth, Catalog, Player, Library, Focus, Memory, UI stores
        └── tests/                # Vitest unit & integration suites
```

---

## Screenshots

> Add captured screenshots to `docs/screenshots/` after running the application locally:

- `![Home Discovery](docs/screenshots/home-discovery.png)` — Featured albums, trending tracks, and bottom audio player.
- `![FocusFlow Dashboard](docs/screenshots/focus-flow.png)` — Pomodoro timer, mode selector, and weekly productivity summary.
- `![MemoryMix Journal](docs/screenshots/memory-mix.png)` — Editorial listening journal with timestamped bookmarks and personal tags.
- `![Mobile Player](docs/screenshots/mobile-player.png)` — Responsive mobile mini-player and navigation bar.

---

## Getting Started (Local Development)

### Prerequisites
- **Node.js** `>= 22.12` (Node 24 LTS recommended; built-in `node:sqlite` is used for local DB fallback)
- **npm** `>= 10`

### 1. Install Dependencies
```bash
npm install
```
*(On Windows PowerShell with restricted script execution policy, use `npm.cmd` instead of `npm`.)*

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```

Review `.env`:
- **Local Development (SQLite fallback)**: Works out of the box with default values. Replace `JWT_SECRET` with a random 32+ character string before production use.
- **Supabase Cloud Mode**: Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.

### 3. Database Setup
- **Local SQLite**: Automatically initialized and seeded in `server/data/soundsphere.db` when the server starts.
- **Supabase PostgreSQL**: Run `supabase/migrations/001_initial_schema.sql` followed by `supabase/seed/seed.sql` in your Supabase SQL Editor. See [docs/DATABASE.md](docs/DATABASE.md) for full details.

### 4. Run Locally
Start both the Express API (`http://localhost:4000`) and Vite frontend (`http://localhost:5173`):
```bash
npm run dev
```

### 5. Run Checks & Tests
```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

---

## Licensed Audio & Legal Notice
All bundled catalog audio uses legally usable CC0 1.0 Public Domain and CC BY 4.0 demo sessions with attribution metadata displayed on album and song pages. No copyrighted third-party audio or scraped assets are included.

---

## Future Production Deployment Guide

1. **Database & Storage (Supabase)**:
   - Apply `supabase/migrations/001_initial_schema.sql` and `supabase/seed/seed.sql`.
   - Verify Row-Level Security (RLS) is enabled across all tables.
2. **Backend API (`server/`)**:
   - Build `shared` and `server` (`npm --workspace=shared run build && npm --workspace=server run build`).
   - Deploy to a Node.js host (Render, Fly.io, Railway, etc.) with `NODE_ENV=production`, a strong `JWT_SECRET`, `CLIENT_ORIGIN=https://your-frontend-domain.com`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
   - Health check endpoint: `GET /api/v1/health`.
3. **Frontend (`client/`)**:
   - Set `VITE_API_BASE_URL=https://your-api-domain.com/api/v1` (plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if using Supabase Auth directly).
   - Build static bundle with `npm --workspace=client run build` and deploy `client/dist/` to Vercel, Cloudflare Pages, or Netlify with SPA fallback routing to `index.html`.
