import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  Album,
  Artist,
  FocusSessionRecord,
  MemoryNote,
  PaginatedMeta,
  PlayHistoryItem,
  Playlist,
  RepeatMode,
  TimestampBookmark,
  Track,
  UserProfile,
  UserTag,
} from '@soundsphere/shared';
import {
  SEED_ALBUMS,
  SEED_ARTISTS,
  SEED_EDITORIAL_PLAYLISTS,
  SEED_TRACKS,
} from '../data/catalog.js';
import { env } from '../config/env.js';
import {
  generateResetToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from '../lib/authTokens.js';
import type {
  AuthSessionResult,
  CatalogFilters,
  DatabaseRepository,
  PaginatedResult,
  QueueRecord,
} from './repository.js';

interface PlaylistRow {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string;
  cover_url: string;
  is_public: number;
  is_system_recommended: number;
  created_at: string;
  updated_at: string;
}

interface TrackRow {
  id: string;
  album_id: string;
  artist_id: string;
  title: string;
  track_number: number;
  duration_ms: number;
  genre: string;
  mood: Track['mood'];
  bpm: number;
  energy_level: number;
  is_instrumental: number;
  license_type: string;
  attribution_text: string;
  trending_rank: number | null;
  synth_json: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  preferred_focus_minutes: number;
  preferred_break_minutes: number;
  preferred_long_break_minutes: number;
  created_at: string;
}

function buildMeta(page: number, limit: number, total: number): PaginatedMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export class SqliteRepository implements DatabaseRepository {
  public readonly kind = 'sqlite' as const;
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
    this.seedCatalog();
  }

  public close(): void {
    this.db.close();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        preferred_focus_minutes INTEGER NOT NULL DEFAULT 25,
        preferred_break_minutes INTEGER NOT NULL DEFAULT 5,
        preferred_long_break_minutes INTEGER NOT NULL DEFAULT 15,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        used_at TEXT
      );

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti TEXT PRIMARY KEY,
        revoked_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        bio TEXT NOT NULL,
        primary_genre TEXT NOT NULL,
        artwork_url TEXT NOT NULL,
        country TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        cover_url TEXT NOT NULL,
        release_date TEXT NOT NULL,
        album_type TEXT NOT NULL,
        genre TEXT NOT NULL,
        featured INTEGER NOT NULL DEFAULT 0,
        is_new_release INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        track_number INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        genre TEXT NOT NULL,
        mood TEXT NOT NULL,
        bpm INTEGER NOT NULL,
        energy_level INTEGER NOT NULL,
        is_instrumental INTEGER NOT NULL DEFAULT 1,
        license_type TEXT NOT NULL,
        attribution_text TEXT NOT NULL,
        trending_rank INTEGER,
        synth_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, track_id)
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cover_url TEXT NOT NULL DEFAULT '',
        is_public INTEGER NOT NULL DEFAULT 0,
        is_system_recommended INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        PRIMARY KEY (playlist_id, track_id)
      );

      CREATE TABLE IF NOT EXISTS play_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_at TEXT NOT NULL,
        context_type TEXT NOT NULL,
        context_id TEXT
      );

      CREATE TABLE IF NOT EXISTS playback_queues (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_track_id TEXT,
        current_position_ms INTEGER NOT NULL DEFAULT 0,
        queue_track_ids TEXT NOT NULL DEFAULT '[]',
        shuffle_enabled INTEGER NOT NULL DEFAULT 0,
        repeat_mode TEXT NOT NULL DEFAULT 'off',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        focus_duration_min INTEGER NOT NULL,
        break_duration_min INTEGER NOT NULL,
        completed_cycles INTEGER NOT NULL DEFAULT 1,
        target_cycles INTEGER NOT NULL DEFAULT 4,
        target_mood TEXT NOT NULL DEFAULT 'all',
        playlist_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL DEFAULT 'completed'
      );

      CREATE TABLE IF NOT EXISTS user_tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        UNIQUE (user_id, name)
      );

      CREATE TABLE IF NOT EXISTS memory_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        timestamp_ms INTEGER NOT NULL,
        note_text TEXT NOT NULL,
        is_bookmark INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_note_tags (
        note_id TEXT NOT NULL REFERENCES memory_notes(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES user_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS timestamp_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        timestamp_ms INTEGER NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (user_id, track_id, timestamp_ms)
      );
    `);
  }

  private seedCatalog(): void {
    const insertArtist = this.db.prepare(
      `INSERT OR IGNORE INTO artists (id, name, slug, bio, primary_genre, artwork_url, country)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of SEED_ARTISTS) {
      insertArtist.run(a.id, a.name, a.slug, a.bio, a.primaryGenre, a.artworkUrl, a.country);
    }

    const insertAlbum = this.db.prepare(
      `INSERT OR IGNORE INTO albums (id, artist_id, title, slug, cover_url, release_date, album_type, genre, featured, is_new_release)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const al of SEED_ALBUMS) {
      insertAlbum.run(
        al.id,
        al.artistId,
        al.title,
        al.slug,
        al.coverUrl,
        al.releaseDate,
        al.albumType,
        al.genre,
        al.featured ? 1 : 0,
        al.isNewRelease ? 1 : 0
      );
    }

    const insertTrack = this.db.prepare(
      `INSERT OR IGNORE INTO tracks (id, album_id, artist_id, title, track_number, duration_ms, genre, mood, bpm, energy_level, is_instrumental, license_type, attribution_text, trending_rank, synth_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const t of SEED_TRACKS) {
      insertTrack.run(
        t.id,
        t.albumId,
        t.artistId,
        t.title,
        t.trackNumber,
        t.durationMs,
        t.genre,
        t.mood,
        t.bpm,
        t.energyLevel,
        t.isInstrumental ? 1 : 0,
        t.licenseType,
        t.attributionText,
        t.trendingRank ?? null,
        JSON.stringify(t.synth)
      );
    }

    const insertPlaylist = this.db.prepare(
      `INSERT OR IGNORE INTO playlists (id, owner_id, owner_name, title, description, cover_url, is_public, is_system_recommended, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPlTrack = this.db.prepare(
      `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
       VALUES (?, ?, ?, ?)`
    );
    for (const pl of SEED_EDITORIAL_PLAYLISTS) {
      insertPlaylist.run(
        pl.id,
        pl.ownerId,
        pl.ownerName,
        pl.title,
        pl.description,
        pl.coverUrl,
        1,
        1,
        pl.createdAt,
        pl.updatedAt
      );
      pl.trackIds.forEach((tid, idx) => {
        insertPlTrack.run(pl.id, tid, idx, pl.createdAt);
      });
    }
  }

  private mapUser(row: UserRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      preferredFocusMinutes: row.preferred_focus_minutes,
      preferredBreakMinutes: row.preferred_break_minutes,
      preferredLongBreakMinutes: row.preferred_long_break_minutes,
      createdAt: row.created_at,
    };
  }

  private mapArtist(row: {
    id: string;
    name: string;
    slug: string;
    bio: string;
    primary_genre: string;
    artwork_url: string;
    country: string;
  }): Artist {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      bio: row.bio,
      primaryGenre: row.primary_genre,
      artworkUrl: row.artwork_url,
      country: row.country,
    };
  }

  private mapAlbum(row: {
    id: string;
    artist_id: string;
    title: string;
    slug: string;
    cover_url: string;
    release_date: string;
    album_type: Album['albumType'];
    genre: string;
    featured: number;
    is_new_release: number;
  }): Album {
    return {
      id: row.id,
      artistId: row.artist_id,
      title: row.title,
      slug: row.slug,
      coverUrl: row.cover_url,
      releaseDate: row.release_date,
      albumType: row.album_type,
      genre: row.genre,
      featured: row.featured === 1,
      isNewRelease: row.is_new_release === 1,
    };
  }

  private mapTrack(row: TrackRow): Track {
    return {
      id: row.id,
      albumId: row.album_id,
      artistId: row.artist_id,
      title: row.title,
      trackNumber: row.track_number,
      durationMs: row.duration_ms,
      genre: row.genre,
      mood: row.mood,
      bpm: row.bpm,
      energyLevel: row.energy_level,
      isInstrumental: row.is_instrumental === 1,
      licenseType: row.license_type,
      attributionText: row.attribution_text,
      trendingRank: row.trending_rank ?? undefined,
      synth: JSON.parse(row.synth_json) as Track['synth'],
    };
  }

  private mapPlaylist(row: PlaylistRow): Playlist {
    const trackRows = this.db
      .prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
      .all(row.id) as unknown as { track_id: string }[];

    return {
      id: row.id,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      title: row.title,
      description: row.description,
      coverUrl: row.cover_url,
      isPublic: row.is_public === 1,
      isSystemRecommended: row.is_system_recommended === 1,
      trackIds: trackRows.map((r) => r.track_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // --- Auth & Profiles ---
  async signup(input: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<AuthSessionResult> {
    const email = input.email.trim().toLowerCase();
    const existing = this.db
      .prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
      .get(email);
    if (existing) {
      throw new Error('EMAIL_IN_USE');
    }

    const id = `usr-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const passwordHash = hashPassword(input.password);

    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, display_name, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, email, passwordHash, input.displayName.trim(), now);

    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as unknown as UserRow;
    const user = this.mapUser(row);
    const { token, expiresAt } = signAccessToken(user, env.JWT_SECRET);
    return { user, accessToken: token, expiresAt };
  }

  async login(input: { email: string; password: string }): Promise<AuthSessionResult | null> {
    const email = input.email.trim().toLowerCase();
    const row = this.db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
      .get(email) as unknown as UserRow | undefined;
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      return null;
    }

    const user = this.mapUser(row);
    const { token, expiresAt } = signAccessToken(user, env.JWT_SECRET);
    return { user, accessToken: token, expiresAt };
  }

  async logout(jti: string): Promise<void> {
    this.db
      .prepare('INSERT OR IGNORE INTO revoked_tokens (jti, revoked_at) VALUES (?, ?)')
      .run(jti, new Date().toISOString());
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT jti FROM revoked_tokens WHERE jti = ?')
      .get(jti);
    return Boolean(row);
  }

  async createPasswordReset(
    email: string
  ): Promise<{ resetToken: string | null; expiresAt: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const row = this.db
      .prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
      .get(cleanEmail) as unknown as { id: string } | undefined;

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    if (!row) {
      return { resetToken: null, expiresAt };
    }

    const { rawToken, tokenHash } = generateResetToken();
    this.db
      .prepare(
        'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
      )
      .run(tokenHash, row.id, expiresAt);

    return { resetToken: rawToken, expiresAt };
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const tokenHash = hashToken(token.trim());
    const row = this.db
      .prepare(
        'SELECT token_hash, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?'
      )
      .get(tokenHash) as unknown as
      | { token_hash: string; user_id: string; expires_at: string; used_at: string | null }
      | undefined;

    if (!row || row.used_at !== null || new Date(row.expires_at).getTime() < Date.now()) {
      return false;
    }

    const nextHash = hashPassword(newPassword);
    this.db
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(nextHash, row.user_id);
    this.db
      .prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?')
      .run(new Date().toISOString(), tokenHash);

    return true;
  }

  async getProfileById(userId: string): Promise<UserProfile | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as unknown as UserRow | undefined;
    return row ? this.mapUser(row) : null;
  }

  async updateProfile(
    userId: string,
    updates: {
      displayName: string;
      preferredFocusMinutes: number;
      preferredBreakMinutes: number;
      preferredLongBreakMinutes: number;
    }
  ): Promise<UserProfile | null> {
    const res = this.db
      .prepare(
        `UPDATE users
         SET display_name = ?, preferred_focus_minutes = ?, preferred_break_minutes = ?, preferred_long_break_minutes = ?
         WHERE id = ?`
      )
      .run(
        updates.displayName.trim(),
        updates.preferredFocusMinutes,
        updates.preferredBreakMinutes,
        updates.preferredLongBreakMinutes,
        userId
      );
    if (Number(res.changes) === 0) return null;
    return this.getProfileById(userId);
  }

  // --- Catalog & Discovery ---
  async getCatalogSnapshot() {
    const artistRows = this.db.prepare('SELECT * FROM artists ORDER BY name ASC').all() as unknown as Parameters<SqliteRepository['mapArtist']>[0][];
    const albumRows = this.db.prepare('SELECT * FROM albums ORDER BY release_date DESC').all() as unknown as Parameters<SqliteRepository['mapAlbum']>[0][];
    const trackRows = this.db.prepare('SELECT * FROM tracks ORDER BY album_id ASC, track_number ASC').all() as unknown as TrackRow[];
    const plRows = this.db
      .prepare('SELECT * FROM playlists WHERE is_system_recommended = 1 ORDER BY created_at ASC')
      .all() as unknown as PlaylistRow[];

    return {
      artists: artistRows.map((r) => this.mapArtist(r)),
      albums: albumRows.map((r) => this.mapAlbum(r)),
      tracks: trackRows.map((r) => this.mapTrack(r)),
      editorialPlaylists: plRows.map((r) => this.mapPlaylist(r)),
    };
  }

  async getSongs(filters: CatalogFilters): Promise<PaginatedResult<Track>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters.q?.trim()) {
      const pattern = `%${filters.q.trim().toLowerCase()}%`;
      clauses.push(
        '(lower(t.title) LIKE ? OR lower(t.genre) LIKE ? OR lower(a.name) LIKE ?)'
      );
      params.push(pattern, pattern, pattern);
    }
    if (filters.genre && filters.genre !== 'All') {
      clauses.push('t.genre = ?');
      params.push(filters.genre);
    }
    if (filters.mood && filters.mood !== 'all') {
      clauses.push('t.mood = ?');
      params.push(filters.mood);
    }
    if (filters.instrumentalOnly) {
      clauses.push('t.is_instrumental = 1');
    }
    if (filters.maxBpm !== undefined) {
      clauses.push('t.bpm <= ?');
      params.push(filters.maxBpm);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) as total FROM tracks t LEFT JOIN artists a ON t.artist_id = a.id ${where}`
      )
      .get(...params) as unknown as { total: number };

    const rows = this.db
      .prepare(
        `SELECT t.* FROM tracks t LEFT JOIN artists a ON t.artist_id = a.id ${where}
         ORDER BY COALESCE(t.trending_rank, 999) ASC, t.title ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as unknown as TrackRow[];

    return {
      items: rows.map((r) => this.mapTrack(r)),
      meta: buildMeta(page, limit, countRow.total),
    };
  }

  async getAlbums(page = 1, limit = 20): Promise<PaginatedResult<Album>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM albums').get() as unknown as { c: number }).c;
    const rows = this.db
      .prepare('SELECT * FROM albums ORDER BY release_date DESC LIMIT ? OFFSET ?')
      .all(safeLimit, offset) as unknown as Parameters<SqliteRepository['mapAlbum']>[0][];
    return {
      items: rows.map((r) => this.mapAlbum(r)),
      meta: buildMeta(safePage, safeLimit, total),
    };
  }

  async getAlbumById(id: string) {
    const albumRow = this.db
      .prepare('SELECT * FROM albums WHERE id = ?')
      .get(id) as unknown as Parameters<SqliteRepository['mapAlbum']>[0] | undefined;
    if (!albumRow) return null;
    const album = this.mapAlbum(albumRow);
    const artistRow = this.db
      .prepare('SELECT * FROM artists WHERE id = ?')
      .get(album.artistId) as unknown as Parameters<SqliteRepository['mapArtist']>[0] | undefined;
    const trackRows = this.db
      .prepare('SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number ASC')
      .all(album.id) as unknown as TrackRow[];
    return {
      album,
      artist: artistRow ? this.mapArtist(artistRow) : null,
      tracks: trackRows.map((r) => this.mapTrack(r)),
    };
  }

  async getArtists(page = 1, limit = 20): Promise<PaginatedResult<Artist>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM artists').get() as unknown as { c: number }).c;
    const rows = this.db
      .prepare('SELECT * FROM artists ORDER BY name ASC LIMIT ? OFFSET ?')
      .all(safeLimit, offset) as unknown as Parameters<SqliteRepository['mapArtist']>[0][];
    return {
      items: rows.map((r) => this.mapArtist(r)),
      meta: buildMeta(safePage, safeLimit, total),
    };
  }

  async getArtistById(id: string) {
    const artistRow = this.db
      .prepare('SELECT * FROM artists WHERE id = ?')
      .get(id) as unknown as Parameters<SqliteRepository['mapArtist']>[0] | undefined;
    if (!artistRow) return null;
    const artist = this.mapArtist(artistRow);
    const albumRows = this.db
      .prepare('SELECT * FROM albums WHERE artist_id = ? ORDER BY release_date DESC')
      .all(artist.id) as unknown as Parameters<SqliteRepository['mapAlbum']>[0][];
    const trackRows = this.db
      .prepare('SELECT * FROM tracks WHERE artist_id = ? ORDER BY track_number ASC')
      .all(artist.id) as unknown as TrackRow[];
    return {
      artist,
      albums: albumRows.map((r) => this.mapAlbum(r)),
      tracks: trackRows.map((r) => this.mapTrack(r)),
    };
  }

  async getTrackById(id: string): Promise<Track | null> {
    const row = this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as unknown as TrackRow | undefined;
    return row ? this.mapTrack(row) : null;
  }

  async searchCatalog(input: {
    q: string;
    type: 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';
    page: number;
    limit: number;
    userId?: string | null;
  }) {
    const tracks = await this.getSongs({ q: input.q, page: input.page, limit: input.limit });
    const pattern = `%${input.q.trim().toLowerCase()}%`;

    const albumRows = (
      input.q.trim()
        ? this.db
            .prepare(
              `SELECT al.* FROM albums al LEFT JOIN artists ar ON al.artist_id = ar.id
               WHERE lower(al.title) LIKE ? OR lower(al.genre) LIKE ? OR lower(ar.name) LIKE ?`
            )
            .all(pattern, pattern, pattern)
        : this.db.prepare('SELECT * FROM albums LIMIT ?').all(input.limit)
    ) as unknown as Parameters<SqliteRepository['mapAlbum']>[0][];

    const artistRows = (
      input.q.trim()
        ? this.db
            .prepare(
              `SELECT * FROM artists WHERE lower(name) LIKE ? OR lower(primary_genre) LIKE ? OR lower(country) LIKE ?`
            )
            .all(pattern, pattern, pattern)
        : this.db.prepare('SELECT * FROM artists LIMIT ?').all(input.limit)
    ) as unknown as Parameters<SqliteRepository['mapArtist']>[0][];

    const plRows = (
      input.q.trim()
        ? this.db
            .prepare(
              `SELECT * FROM playlists
               WHERE (is_public = 1 OR owner_id = ?) AND (lower(title) LIKE ? OR lower(description) LIKE ?)`
            )
            .all(input.userId ?? '', pattern, pattern)
        : this.db
            .prepare('SELECT * FROM playlists WHERE is_public = 1 OR owner_id = ?')
            .all(input.userId ?? '')
    ) as unknown as PlaylistRow[];

    return {
      tracks,
      albums: albumRows.map((r) => this.mapAlbum(r)),
      artists: artistRows.map((r) => this.mapArtist(r)),
      playlists: plRows.map((r) => this.mapPlaylist(r)),
    };
  }

  // --- Favorites ---
  async getFavorites(userId: string, page = 1, limit = 50): Promise<PaginatedResult<string>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const total = (
      this.db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(userId) as unknown as {
        c: number;
      }
    ).c;
    const rows = this.db
      .prepare('SELECT track_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(userId, safeLimit, offset) as unknown as { track_id: string }[];
    return {
      items: rows.map((r) => r.track_id),
      meta: buildMeta(safePage, safeLimit, total),
    };
  }

  async addFavorite(userId: string, trackId: string): Promise<string[]> {
    this.db
      .prepare('INSERT OR IGNORE INTO favorites (user_id, track_id, created_at) VALUES (?, ?, ?)')
      .run(userId, trackId, new Date().toISOString());
    return (await this.getFavorites(userId, 1, 100)).items;
  }

  async removeFavorite(userId: string, trackId: string): Promise<string[]> {
    this.db
      .prepare('DELETE FROM favorites WHERE user_id = ? AND track_id = ?')
      .run(userId, trackId);
    return (await this.getFavorites(userId, 1, 100)).items;
  }

  // --- Playlists ---
  async getPlaylists(userId: string, page = 1, limit = 50): Promise<PaginatedResult<Playlist>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const total = (
      this.db
        .prepare('SELECT COUNT(*) as c FROM playlists WHERE owner_id = ? AND is_system_recommended = 0')
        .get(userId) as unknown as { c: number }
    ).c;
    const rows = this.db
      .prepare(
        'SELECT * FROM playlists WHERE owner_id = ? AND is_system_recommended = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?'
      )
      .all(userId, safeLimit, offset) as unknown as PlaylistRow[];
    return {
      items: rows.map((r) => this.mapPlaylist(r)),
      meta: buildMeta(safePage, safeLimit, total),
    };
  }

  async getPlaylistById(userId: string | null, playlistId: string): Promise<Playlist | null> {
    const row = this.db
      .prepare('SELECT * FROM playlists WHERE id = ? AND (is_public = 1 OR owner_id = ?)')
      .get(playlistId, userId ?? '') as unknown as PlaylistRow | undefined;
    return row ? this.mapPlaylist(row) : null;
  }

  async createPlaylist(
    userId: string,
    ownerName: string,
    input: { title: string; description: string; isPublic: boolean; trackIds?: string[] }
  ): Promise<Playlist> {
    const id = `upl-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const coverKeys = ['pl-deep-work', 'pl-late-night', 'pl-acoustic-morning', 'pl-low-light'];
    const existingCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM playlists WHERE owner_id = ?').get(userId) as unknown as {
        cnt: number;
      }
    ).cnt;
    const coverKey = coverKeys[existingCount % coverKeys.length];

    this.db
      .prepare(
        `INSERT INTO playlists (id, owner_id, owner_name, title, description, cover_url, is_public, is_system_recommended, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        userId,
        ownerName,
        input.title.trim(),
        input.description.trim(),
        coverKey,
        input.isPublic ? 1 : 0,
        now,
        now
      );

    if (input.trackIds && input.trackIds.length > 0) {
      const insertTrack = this.db.prepare(
        'INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)'
      );
      input.trackIds.forEach((tid, idx) => {
        insertTrack.run(id, tid, idx, now);
      });
    }

    return (await this.getPlaylistById(userId, id))!;
  }

  async updatePlaylist(
    userId: string,
    playlistId: string,
    updates: { title?: string; description?: string; isPublic?: boolean }
  ): Promise<Playlist | null> {
    const existing = this.db
      .prepare('SELECT * FROM playlists WHERE id = ? AND owner_id = ?')
      .get(playlistId, userId) as unknown as PlaylistRow | undefined;
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE playlists
         SET title = ?, description = ?, is_public = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`
      )
      .run(
        updates.title !== undefined ? updates.title.trim() : existing.title,
        updates.description !== undefined ? updates.description.trim() : existing.description,
        updates.isPublic !== undefined ? (updates.isPublic ? 1 : 0) : existing.is_public,
        now,
        playlistId,
        userId
      );

    return this.getPlaylistById(userId, playlistId);
  }

  async deletePlaylist(userId: string, playlistId: string): Promise<boolean> {
    const res = this.db
      .prepare('DELETE FROM playlists WHERE id = ? AND owner_id = ?')
      .run(playlistId, userId);
    return Number(res.changes) > 0;
  }

  async addTrackToPlaylist(
    userId: string,
    playlistId: string,
    trackId: string
  ): Promise<Playlist | null> {
    const existing = this.db
      .prepare('SELECT id FROM playlists WHERE id = ? AND owner_id = ?')
      .get(playlistId, userId);
    if (!existing) return null;

    const maxRow = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) as maxPos FROM playlist_tracks WHERE playlist_id = ?')
      .get(playlistId) as unknown as { maxPos: number };

    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)'
      )
      .run(playlistId, trackId, maxRow.maxPos + 1, now);

    this.db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(now, playlistId);
    return this.getPlaylistById(userId, playlistId);
  }

  async removeTrackFromPlaylist(
    userId: string,
    playlistId: string,
    trackId: string
  ): Promise<Playlist | null> {
    const existing = this.db
      .prepare('SELECT id FROM playlists WHERE id = ? AND owner_id = ?')
      .get(playlistId, userId);
    if (!existing) return null;

    this.db
      .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
      .run(playlistId, trackId);

    const remaining = this.db
      .prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
      .all(playlistId) as unknown as { track_id: string }[];

    const updatePos = this.db.prepare(
      'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'
    );
    remaining.forEach((row, idx) => {
      updatePos.run(idx, playlistId, row.track_id);
    });

    this.db
      .prepare('UPDATE playlists SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), playlistId);

    return this.getPlaylistById(userId, playlistId);
  }

  async reorderPlaylistTracks(
    userId: string,
    playlistId: string,
    trackIds: string[]
  ): Promise<Playlist | null> {
    const existing = this.db
      .prepare('SELECT id FROM playlists WHERE id = ? AND owner_id = ?')
      .get(playlistId, userId);
    if (!existing) return null;

    const updatePos = this.db.prepare(
      'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'
    );
    trackIds.forEach((tid, idx) => {
      updatePos.run(idx, playlistId, tid);
    });

    this.db
      .prepare('UPDATE playlists SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), playlistId);

    return this.getPlaylistById(userId, playlistId);
  }

  // --- History & Queue ---
  async getHistory(userId: string, page = 1, limit = 24): Promise<PaginatedResult<PlayHistoryItem>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const total = (
      this.db.prepare('SELECT COUNT(*) as c FROM play_history WHERE user_id = ?').get(userId) as unknown as {
        c: number;
      }
    ).c;

    const rows = this.db
      .prepare(
        'SELECT id, track_id, played_at, context_type, context_id FROM play_history WHERE user_id = ? ORDER BY played_at DESC LIMIT ? OFFSET ?'
      )
      .all(userId, safeLimit, offset) as unknown as {
      id: string;
      track_id: string;
      played_at: string;
      context_type: PlayHistoryItem['contextType'];
      context_id: string | null;
    }[];

    return {
      items: rows.map((r) => ({
        id: r.id,
        trackId: r.track_id,
        playedAt: r.played_at,
        contextType: r.context_type,
        contextId: r.context_id ?? undefined,
      })),
      meta: buildMeta(safePage, safeLimit, total),
    };
  }

  async recordHistory(
    userId: string,
    trackId: string,
    contextType: PlayHistoryItem['contextType'],
    contextId?: string
  ): Promise<PlayHistoryItem> {
    const id = `hist-${crypto.randomUUID().slice(0, 8)}`;
    const playedAt = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO play_history (id, user_id, track_id, played_at, context_type, context_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, userId, trackId, playedAt, contextType, contextId ?? null);

    return { id, trackId, playedAt, contextType, contextId };
  }

  async getQueue(userId: string): Promise<QueueRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM playback_queues WHERE user_id = ?')
      .get(userId) as unknown as
      | {
          current_track_id: string | null;
          current_position_ms: number;
          queue_track_ids: string;
          shuffle_enabled: number;
          repeat_mode: RepeatMode;
        }
      | undefined;
    if (!row) return null;
    return {
      currentTrackId: row.current_track_id,
      currentPositionMs: row.current_position_ms,
      queueTrackIds: JSON.parse(row.queue_track_ids) as string[],
      shuffle: row.shuffle_enabled === 1,
      repeatMode: row.repeat_mode,
    };
  }

  async saveQueue(userId: string, queue: QueueRecord): Promise<QueueRecord> {
    this.db
      .prepare(
        `INSERT INTO playback_queues (user_id, current_track_id, current_position_ms, queue_track_ids, shuffle_enabled, repeat_mode, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           current_track_id = excluded.current_track_id,
           current_position_ms = excluded.current_position_ms,
           queue_track_ids = excluded.queue_track_ids,
           shuffle_enabled = excluded.shuffle_enabled,
           repeat_mode = excluded.repeat_mode,
           updated_at = excluded.updated_at`
      )
      .run(
        userId,
        queue.currentTrackId,
        queue.currentPositionMs,
        JSON.stringify(queue.queueTrackIds),
        queue.shuffle ? 1 : 0,
        queue.repeatMode,
        new Date().toISOString()
      );
    return queue;
  }

  // --- FocusFlow ---
  async getFocusSessions(
    userId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResult<FocusSessionRecord>> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const total = (
      this.db.prepare('SELECT COUNT(*) as c FROM focus_sessions WHERE user_id = ?').get(userId) as unknown as {
        c: number;
      }
    ).c;

    const rows = this.db
      .prepare(
        `SELECT id, mode, focus_duration_min, break_duration_min, completed_cycles, target_cycles, target_mood, playlist_id, started_at, ended_at, status
         FROM focus_sessions
         WHERE user_id = ?
         ORDER BY started_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(userId, safeLimit, offset) as unknown as {
      id: string;
      mode: FocusSessionRecord['mode'];
      focus_duration_min: number;
      break_duration_min: number;
      completed_cycles: number;
      target_cycles: number;
      target_mood: FocusSessionRecord['targetMood'];
      playlist_id: string | null;
      started_at: string;
      ended_at: string | null;
      status: FocusSessionRecord['status'];
    }[];

    return {
      items: rows.map((r) => ({
        id: r.id,
        mode: r.mode,
        focusDurationMin: r.focus_duration_min,
        breakDurationMin: r.break_duration_min,
        completedCycles: r.completed_cycles,
        targetCycles: r.target_cycles,
        targetMood: r.target_mood,
        playlistId: r.playlist_id ?? undefined,
        startedAt: r.started_at,
        endedAt: r.ended_at ?? undefined,
        status: r.status,
      })),
      meta: buildMeta(safePage, safeLimit, total),
    };
  }

  async recordFocusSession(
    userId: string,
    session: Omit<FocusSessionRecord, 'id'>
  ): Promise<FocusSessionRecord> {
    const id = `foc-${crypto.randomUUID().slice(0, 8)}`;
    const endedAt = session.endedAt ?? new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO focus_sessions (
          id, user_id, mode, focus_duration_min, break_duration_min,
          completed_cycles, target_cycles, target_mood, playlist_id,
          started_at, ended_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        userId,
        session.mode,
        session.focusDurationMin,
        session.breakDurationMin,
        session.completedCycles,
        session.targetCycles,
        session.targetMood,
        session.playlistId ?? null,
        session.startedAt,
        endedAt,
        session.status
      );

    return { id, ...session, endedAt };
  }

  // --- MemoryMix ---
  private mapMemoryNote(row: {
    id: string;
    track_id: string;
    timestamp_ms: number;
    note_text: string;
    is_bookmark: number;
    created_at: string;
    updated_at: string;
  }): MemoryNote {
    const tagRows = this.db
      .prepare('SELECT tag_id FROM memory_note_tags WHERE note_id = ?')
      .all(row.id) as unknown as { tag_id: string }[];

    return {
      id: row.id,
      trackId: row.track_id,
      timestampMs: row.timestamp_ms,
      noteText: row.note_text,
      isBookmark: row.is_bookmark === 1,
      tagIds: tagRows.map((t) => t.tag_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private filterOwnedTags(userId: string, tagIds: string[]): string[] {
    if (tagIds.length === 0) return [];
    const ownedRows = this.db
      .prepare('SELECT id FROM user_tags WHERE user_id = ?')
      .all(userId) as unknown as { id: string }[];
    const ownedSet = new Set(ownedRows.map((r) => r.id));
    return Array.from(new Set(tagIds.filter((id) => ownedSet.has(id))));
  }

  async getMemoryTags(userId: string): Promise<UserTag[]> {
    const rows = this.db
      .prepare('SELECT id, name, color_hex FROM user_tags WHERE user_id = ? ORDER BY name ASC')
      .all(userId) as unknown as { id: string; name: string; color_hex: string }[];
    return rows.map((r) => ({ id: r.id, name: r.name, colorHex: r.color_hex }));
  }

  async createMemoryTag(userId: string, name: string, colorHex: string): Promise<UserTag> {
    const cleanName = name.trim();
    const existing = this.db
      .prepare('SELECT id, name, color_hex FROM user_tags WHERE user_id = ? AND lower(name) = lower(?)')
      .get(userId, cleanName) as unknown as { id: string; name: string; color_hex: string } | undefined;

    if (existing) {
      return { id: existing.id, name: existing.name, colorHex: existing.color_hex };
    }

    const id = `tag-${crypto.randomUUID().slice(0, 8)}`;
    this.db
      .prepare('INSERT INTO user_tags (id, user_id, name, color_hex) VALUES (?, ?, ?, ?)')
      .run(id, userId, cleanName, colorHex);
    return { id, name: cleanName, colorHex };
  }

  async deleteMemoryTag(userId: string, tagId: string): Promise<boolean> {
    const res = this.db
      .prepare('DELETE FROM user_tags WHERE id = ? AND user_id = ?')
      .run(tagId, userId);
    return Number(res.changes) > 0;
  }

  async getMemoryNotes(
    userId: string,
    filters: {
      q?: string;
      tagId?: string;
      trackId?: string;
      bookmarksOnly?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResult<MemoryNote>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));

    const allRows = this.db
      .prepare(
        `SELECT id, track_id, timestamp_ms, note_text, is_bookmark, created_at, updated_at
         FROM memory_notes
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId) as unknown as {
      id: string;
      track_id: string;
      timestamp_ms: number;
      note_text: string;
      is_bookmark: number;
      created_at: string;
      updated_at: string;
    }[];

    let mapped = allRows.map((r) => this.mapMemoryNote(r));
    if (filters.bookmarksOnly) mapped = mapped.filter((n) => n.isBookmark);
    if (filters.trackId && filters.trackId !== 'all') {
      mapped = mapped.filter((n) => n.trackId === filters.trackId);
    }
    if (filters.tagId && filters.tagId !== 'all') {
      mapped = mapped.filter((n) => n.tagIds.includes(filters.tagId!));
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      mapped = mapped.filter((n) => n.noteText.toLowerCase().includes(q));
    }

    const total = mapped.length;
    const offset = (page - 1) * limit;
    return {
      items: mapped.slice(offset, offset + limit),
      meta: buildMeta(page, limit, total),
    };
  }

  async upsertMemoryNote(
    userId: string,
    input: {
      trackId: string;
      timestampMs: number;
      noteText: string;
      isBookmark: boolean;
      tagIds: string[];
    }
  ): Promise<{ note: MemoryNote; deduplicated: boolean }> {
    const safeTimestamp = Math.max(0, Math.round(input.timestampMs));
    const bucketStart = Math.floor(safeTimestamp / 1000) * 1000;
    const bucketEnd = bucketStart + 999;
    const ownedTags = this.filterOwnedTags(userId, input.tagIds);
    const now = new Date().toISOString();

    if (input.isBookmark) {
      const existingBookmark = this.db
        .prepare(
          `SELECT id, track_id, timestamp_ms, note_text, is_bookmark, created_at, updated_at
           FROM memory_notes
           WHERE user_id = ? AND track_id = ? AND is_bookmark = 1 AND timestamp_ms BETWEEN ? AND ?`
        )
        .get(userId, input.trackId, bucketStart, bucketEnd) as unknown as
        | {
            id: string;
            track_id: string;
            timestamp_ms: number;
            note_text: string;
            is_bookmark: number;
            created_at: string;
            updated_at: string;
          }
        | undefined;

      if (existingBookmark) {
        const nextText = input.noteText.trim() ? input.noteText.trim() : existingBookmark.note_text;
        this.db
          .prepare('UPDATE memory_notes SET note_text = ?, updated_at = ? WHERE id = ? AND user_id = ?')
          .run(nextText, now, existingBookmark.id, userId);

        const insertTag = this.db.prepare(
          'INSERT OR IGNORE INTO memory_note_tags (note_id, tag_id) VALUES (?, ?)'
        );
        for (const tid of ownedTags) {
          insertTag.run(existingBookmark.id, tid);
        }

        await this.upsertTimestampBookmark(userId, {
          trackId: input.trackId,
          timestampMs: existingBookmark.timestamp_ms,
          label: nextText,
        });

        const updatedRow = this.db
          .prepare('SELECT id, track_id, timestamp_ms, note_text, is_bookmark, created_at, updated_at FROM memory_notes WHERE id = ?')
          .get(existingBookmark.id) as unknown as {
          id: string;
          track_id: string;
          timestamp_ms: number;
          note_text: string;
          is_bookmark: number;
          created_at: string;
          updated_at: string;
        };

        return { note: this.mapMemoryNote(updatedRow), deduplicated: true };
      }
    }

    const id = `mem-${crypto.randomUUID().slice(0, 8)}`;
    this.db
      .prepare(
        `INSERT INTO memory_notes (id, user_id, track_id, timestamp_ms, note_text, is_bookmark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        userId,
        input.trackId,
        safeTimestamp,
        input.noteText.trim(),
        input.isBookmark ? 1 : 0,
        now,
        now
      );

    const insertTag = this.db.prepare(
      'INSERT OR IGNORE INTO memory_note_tags (note_id, tag_id) VALUES (?, ?)'
    );
    for (const tid of ownedTags) {
      insertTag.run(id, tid);
    }

    if (input.isBookmark) {
      await this.upsertTimestampBookmark(userId, {
        trackId: input.trackId,
        timestampMs: safeTimestamp,
        label: input.noteText.trim(),
      });
    }

    const createdRow = this.db
      .prepare('SELECT id, track_id, timestamp_ms, note_text, is_bookmark, created_at, updated_at FROM memory_notes WHERE id = ?')
      .get(id) as unknown as {
      id: string;
      track_id: string;
      timestamp_ms: number;
      note_text: string;
      is_bookmark: number;
      created_at: string;
      updated_at: string;
    };

    return { note: this.mapMemoryNote(createdRow), deduplicated: false };
  }

  async updateMemoryNote(
    userId: string,
    noteId: string,
    updates: {
      noteText?: string;
      isBookmark?: boolean;
      timestampMs?: number;
      tagIds?: string[];
    }
  ): Promise<MemoryNote | null> {
    const existing = this.db
      .prepare('SELECT * FROM memory_notes WHERE id = ? AND user_id = ?')
      .get(noteId, userId) as unknown as
      | {
          id: string;
          track_id: string;
          timestamp_ms: number;
          note_text: string;
          is_bookmark: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!existing) return null;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE memory_notes
         SET note_text = ?, is_bookmark = ?, timestamp_ms = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        updates.noteText !== undefined ? updates.noteText.trim() : existing.note_text,
        updates.isBookmark !== undefined ? (updates.isBookmark ? 1 : 0) : existing.is_bookmark,
        updates.timestampMs !== undefined ? Math.max(0, Math.round(updates.timestampMs)) : existing.timestamp_ms,
        now,
        noteId,
        userId
      );

    if (updates.tagIds !== undefined) {
      this.db.prepare('DELETE FROM memory_note_tags WHERE note_id = ?').run(noteId);
      const ownedTags = this.filterOwnedTags(userId, updates.tagIds);
      const insertTag = this.db.prepare(
        'INSERT OR IGNORE INTO memory_note_tags (note_id, tag_id) VALUES (?, ?)'
      );
      for (const tid of ownedTags) {
        insertTag.run(noteId, tid);
      }
    }

    const updatedRow = this.db
      .prepare('SELECT id, track_id, timestamp_ms, note_text, is_bookmark, created_at, updated_at FROM memory_notes WHERE id = ?')
      .get(noteId) as unknown as {
      id: string;
      track_id: string;
      timestamp_ms: number;
      note_text: string;
      is_bookmark: number;
      created_at: string;
      updated_at: string;
    };

    return this.mapMemoryNote(updatedRow);
  }

  async deleteMemoryNote(userId: string, noteId: string): Promise<boolean> {
    const res = this.db
      .prepare('DELETE FROM memory_notes WHERE id = ? AND user_id = ?')
      .run(noteId, userId);
    return Number(res.changes) > 0;
  }

  async getTimestampBookmarks(userId: string, trackId?: string): Promise<TimestampBookmark[]> {
    const rows = (
      trackId
        ? this.db
            .prepare(
              'SELECT id, track_id, timestamp_ms, label, created_at FROM timestamp_bookmarks WHERE user_id = ? AND track_id = ? ORDER BY timestamp_ms ASC'
            )
            .all(userId, trackId)
        : this.db
            .prepare(
              'SELECT id, track_id, timestamp_ms, label, created_at FROM timestamp_bookmarks WHERE user_id = ? ORDER BY created_at DESC'
            )
            .all(userId)
    ) as unknown as {
      id: string;
      track_id: string;
      timestamp_ms: number;
      label: string;
      created_at: string;
    }[];

    return rows.map((r) => ({
      id: r.id,
      trackId: r.track_id,
      timestampMs: r.timestamp_ms,
      label: r.label,
      createdAt: r.created_at,
    }));
  }

  async upsertTimestampBookmark(
    userId: string,
    input: { trackId: string; timestampMs: number; label: string }
  ): Promise<{ bookmark: TimestampBookmark; deduplicated: boolean }> {
    const safeTs = Math.max(0, Math.round(input.timestampMs));
    const bucketStart = Math.floor(safeTs / 1000) * 1000;
    const bucketEnd = bucketStart + 999;

    const existing = this.db
      .prepare(
        `SELECT id, track_id, timestamp_ms, label, created_at
         FROM timestamp_bookmarks
         WHERE user_id = ? AND track_id = ? AND timestamp_ms BETWEEN ? AND ?`
      )
      .get(userId, input.trackId, bucketStart, bucketEnd) as unknown as
      | { id: string; track_id: string; timestamp_ms: number; label: string; created_at: string }
      | undefined;

    if (existing) {
      const nextLabel = input.label.trim() || existing.label;
      this.db
        .prepare('UPDATE timestamp_bookmarks SET label = ? WHERE id = ? AND user_id = ?')
        .run(nextLabel, existing.id, userId);
      return {
        bookmark: {
          id: existing.id,
          trackId: existing.track_id,
          timestampMs: existing.timestamp_ms,
          label: nextLabel,
          createdAt: existing.created_at,
        },
        deduplicated: true,
      };
    }

    const id = `bmk-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO timestamp_bookmarks (id, user_id, track_id, timestamp_ms, label, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, userId, input.trackId, safeTs, input.label.trim(), now);

    return {
      bookmark: {
        id,
        trackId: input.trackId,
        timestampMs: safeTs,
        label: input.label.trim(),
        createdAt: now,
      },
      deduplicated: false,
    };
  }

  async deleteTimestampBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    const res = this.db
      .prepare('DELETE FROM timestamp_bookmarks WHERE id = ? AND user_id = ?')
      .run(bookmarkId, userId);
    return Number(res.changes) > 0;
  }
}
