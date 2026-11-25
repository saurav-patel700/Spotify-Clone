-- SoundSphere Initial PostgreSQL Schema & Row-Level Security (Supabase)
-- Run via Supabase SQL Editor or `supabase db push`

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferred_focus_minutes INTEGER NOT NULL DEFAULT 25 CHECK (preferred_focus_minutes BETWEEN 5 AND 90),
  preferred_break_minutes INTEGER NOT NULL DEFAULT 5 CHECK (preferred_break_minutes BETWEEN 1 AND 30),
  preferred_long_break_minutes INTEGER NOT NULL DEFAULT 15 CHECK (preferred_long_break_minutes BETWEEN 5 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Catalog Tables
CREATE TABLE IF NOT EXISTS public.artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT NOT NULL DEFAULT '',
  primary_genre TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.albums (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cover_url TEXT NOT NULL,
  release_date DATE NOT NULL,
  album_type TEXT NOT NULL CHECK (album_type IN ('album', 'ep', 'single')),
  genre TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new_release BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  track_number INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  audio_path TEXT NOT NULL,
  genre TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('ambient', 'lofi', 'minimal', 'electronic', 'acoustic')),
  bpm INTEGER NOT NULL CHECK (bpm BETWEEN 40 AND 220),
  energy_level SMALLINT NOT NULL CHECK (energy_level BETWEEN 1 AND 10),
  is_instrumental BOOLEAN NOT NULL DEFAULT TRUE,
  license_type TEXT NOT NULL,
  attribution_text TEXT NOT NULL,
  trending_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User Library, Playlists, Queue & History
CREATE TABLE IF NOT EXISTS public.playlists (
  id TEXT PRIMARY KEY DEFAULT ('upl-' || substr(gen_random_uuid()::text, 1, 8)),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS public.play_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context_type TEXT NOT NULL CHECK (context_type IN ('album', 'playlist', 'search', 'focus_flow', 'memory_mix', 'direct')),
  context_id TEXT
);

CREATE TABLE IF NOT EXISTS public.playback_queues (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_track_id TEXT REFERENCES public.tracks(id) ON DELETE SET NULL,
  current_position_ms INTEGER NOT NULL DEFAULT 0,
  queue_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  shuffle_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  repeat_mode TEXT NOT NULL DEFAULT 'off' CHECK (repeat_mode IN ('off', 'one', 'all')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. FocusFlow & MemoryMix
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('deep_work', 'study', 'relax', 'break', 'custom')),
  focus_duration_min INTEGER NOT NULL,
  break_duration_min INTEGER NOT NULL,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  target_cycles INTEGER NOT NULL DEFAULT 4,
  target_mood TEXT NOT NULL DEFAULT 'all',
  instrumental_only BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'ended_early')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.memory_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL CHECK (timestamp_ms >= 0),
  note_text TEXT NOT NULL,
  is_bookmark BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memory_note_tags (
  note_id UUID NOT NULL REFERENCES public.memory_notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.user_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.timestamp_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL CHECK (timestamp_ms >= 0),
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, track_id, timestamp_ms)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm ON public.tracks USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON public.artists USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm ON public.albums USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_play_history_user_played ON public.play_history (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_notes_user_track ON public.memory_notes (user_id, track_id, timestamp_ms ASC);
CREATE INDEX IF NOT EXISTS idx_tracks_focus ON public.tracks (is_instrumental, energy_level, mood);

-- 6. Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timestamp_bookmarks ENABLE ROW LEVEL SECURITY;

-- Public read for catalog
CREATE POLICY "Public read artists" ON public.artists FOR SELECT USING (TRUE);
CREATE POLICY "Public read albums" ON public.albums FOR SELECT USING (TRUE);
CREATE POLICY "Public read tracks" ON public.tracks FOR SELECT USING (TRUE);

-- User-owned policies
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own history" ON public.play_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own queue" ON public.playback_queues FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own focus sessions" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own tags" ON public.user_tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own memory notes" ON public.memory_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own memory note tags" ON public.memory_note_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.memory_notes n
      WHERE n.id = note_id AND n.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memory_notes n
      WHERE n.id = note_id AND n.user_id = auth.uid()
    )
  );

-- Prevent duplicate timeline bookmarks at the exact same millisecond per user & track
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_track_bookmark_ts
  ON public.memory_notes (user_id, track_id, timestamp_ms)
  WHERE is_bookmark = TRUE;

CREATE POLICY "Users manage own timestamp bookmarks" ON public.timestamp_bookmarks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Read public or owned playlists" ON public.playlists
  FOR SELECT USING (is_public = TRUE OR auth.uid() = owner_id);
CREATE POLICY "Manage owned playlists" ON public.playlists
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Read playlist tracks of accessible playlists" ON public.playlist_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND (p.is_public = TRUE OR p.owner_id = auth.uid())
    )
  );
CREATE POLICY "Manage playlist tracks of owned playlists" ON public.playlist_tracks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND p.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND p.owner_id = auth.uid()
    )
  );

