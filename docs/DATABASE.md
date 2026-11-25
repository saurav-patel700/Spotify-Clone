# Database Setup Guide

SoundSphere supports **Supabase PostgreSQL** for production deployments and Node's built-in **`node:sqlite`** (`SqliteRepository`) for zero-configuration local development.

---

## Tables Overview

1. **Identity & Catalog**
   - `profiles` (linked to `auth.users` in Supabase; `users` table in local SQLite)
   - `artists`
   - `albums`
   - `tracks`
2. **Library, Queue & Playback**
   - `playlists`
   - `playlist_tracks` (ordered join table with unique `(playlist_id, track_id)`)
   - `favorites` (liked songs, primary key `(user_id, track_id)`)
   - `play_history`
   - `playback_queues`
3. **FocusFlow**
   - `focus_sessions` (mode, durations, completed cycles, mood, status, timestamps)
4. **MemoryMix**
   - `memory_notes` (private song notes with timestamp & bookmark flag)
   - `timestamp_bookmarks` (deduplicated per `(user_id, track_id, timestamp_ms)`)
   - `user_tags` (user-scoped private tags)
   - `memory_note_tags` (many-to-many join between `memory_notes` and `user_tags`)

---

## Supabase PostgreSQL Setup

1. Create a new Supabase project.
2. Open the **SQL Editor** and run [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql).
   - Enables `pgcrypto` and `pg_trgm` extensions.
   - Creates all tables, indexes, and the `on_auth_user_created` profile trigger.
   - Enables Row-Level Security (RLS) on all tables so users can only access and modify their own playlists, favorites, history, focus sessions, notes, tags, and bookmarks.
3. Run [`supabase/seed/seed.sql`](../supabase/seed/seed.sql) to populate the licensed CC0 / CC BY 4.0 catalog (`artists`, `albums`, `tracks`).
4. Configure `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## Local SQLite Development Setup

When `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are not configured (or left as placeholders from `.env.example`), the Express server automatically uses `SqliteRepository`:

- Database file location: `SQLITE_PATH` (defaults to `./data/soundsphere.db`).
- Schema creation and catalog seeding run automatically on startup.
- New user accounts start with an empty library, empty FocusFlow history, and an empty MemoryMix journal.
