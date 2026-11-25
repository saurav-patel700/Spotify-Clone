import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
import type {
  AuthSessionResult,
  CatalogFilters,
  DatabaseRepository,
  PaginatedResult,
  QueueRecord,
} from './repository.js';

function buildMeta(page: number, limit: number, total: number): PaginatedMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export class SupabaseRepository implements DatabaseRepository {
  public readonly kind = 'supabase' as const;
  private client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async signup(input: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<AuthSessionResult> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { data: { display_name: input.displayName.trim() } },
    });
    if (error || !data.user || !data.session) {
      throw new Error(error?.message ?? 'Signup failed');
    }
    const profile = (await this.getProfileById(data.user.id)) ?? {
      id: data.user.id,
      email: data.user.email ?? input.email,
      displayName: input.displayName.trim(),
      preferredFocusMinutes: 25,
      preferredBreakMinutes: 5,
      preferredLongBreakMinutes: 15,
      createdAt: data.user.created_at,
    };
    return {
      user: profile,
      accessToken: data.session.access_token,
      expiresAt: new Date((data.session.expires_at ?? 0) * 1000).toISOString(),
    };
  }

  async login(input: { email: string; password: string }): Promise<AuthSessionResult | null> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (error || !data.user || !data.session) return null;
    const profile = await this.getProfileById(data.user.id);
    if (!profile) return null;
    return {
      user: profile,
      accessToken: data.session.access_token,
      expiresAt: new Date((data.session.expires_at ?? 0) * 1000).toISOString(),
    };
  }

  async logout(_jti: string): Promise<void> {
    void _jti;
  }

  async isTokenRevoked(_jti: string): Promise<boolean> {
    void _jti;
    return false;
  }

  async createPasswordReset(
    email: string
  ): Promise<{ resetToken: string | null; expiresAt: string }> {
    await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase());
    return {
      resetToken: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async resetPassword(_token: string, _newPassword: string): Promise<boolean> {
    void _token;
    void _newPassword;
    return false;
  }

  async getProfileById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id as string,
      email: '',
      displayName: data.display_name as string,
      preferredFocusMinutes: data.preferred_focus_minutes as number,
      preferredBreakMinutes: data.preferred_break_minutes as number,
      preferredLongBreakMinutes: data.preferred_long_break_minutes as number,
      createdAt: data.created_at as string,
    };
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
    const { error } = await this.client
      .from('profiles')
      .update({
        display_name: updates.displayName.trim(),
        preferred_focus_minutes: updates.preferredFocusMinutes,
        preferred_break_minutes: updates.preferredBreakMinutes,
        preferred_long_break_minutes: updates.preferredLongBreakMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) return null;
    return this.getProfileById(userId);
  }

  async getCatalogSnapshot() {
    const { data: artists } = await this.client.from('artists').select('*').order('name');
    const { data: albums } = await this.client
      .from('albums')
      .select('*')
      .order('release_date', { ascending: false });
    const { data: tracks } = await this.client
      .from('tracks')
      .select('*')
      .order('album_id')
      .order('track_number');

    const synthById = new Map(SEED_TRACKS.map((t) => [t.id, t.synth]));
    const mappedTracks: Track[] =
      tracks && tracks.length > 0
        ? tracks.map((t) => ({
            id: t.id as string,
            albumId: t.album_id as string,
            artistId: t.artist_id as string,
            title: t.title as string,
            trackNumber: t.track_number as number,
            durationMs: t.duration_ms as number,
            genre: t.genre as string,
            mood: t.mood as Track['mood'],
            bpm: t.bpm as number,
            energyLevel: t.energy_level as number,
            isInstrumental: Boolean(t.is_instrumental),
            licenseType: t.license_type as string,
            attributionText: t.attribution_text as string,
            trendingRank: (t.trending_rank as number | null) ?? undefined,
            synth: synthById.get(t.id as string) ?? SEED_TRACKS[0].synth,
          }))
        : SEED_TRACKS;

    return {
      artists:
        artists && artists.length > 0
          ? artists.map((a) => ({
              id: a.id as string,
              name: a.name as string,
              slug: a.slug as string,
              bio: (a.bio as string) ?? '',
              primaryGenre: a.primary_genre as string,
              artworkUrl: a.artwork_url as string,
              country: (a.country as string) ?? '',
            }))
          : SEED_ARTISTS,
      albums:
        albums && albums.length > 0
          ? albums.map((al) => ({
              id: al.id as string,
              artistId: al.artist_id as string,
              title: al.title as string,
              slug: al.slug as string,
              coverUrl: al.cover_url as string,
              releaseDate: al.release_date as string,
              albumType: al.album_type as Album['albumType'],
              genre: al.genre as string,
              featured: Boolean(al.featured),
              isNewRelease: Boolean(al.is_new_release),
            }))
          : SEED_ALBUMS,
      tracks: mappedTracks,
      editorialPlaylists: SEED_EDITORIAL_PLAYLISTS,
    };
  }

  async getSongs(filters: CatalogFilters): Promise<PaginatedResult<Track>> {
    const snap = await this.getCatalogSnapshot();
    const artistMap = new Map(snap.artists.map((a) => [a.id, a]));
    let list = snap.tracks;
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          (artistMap.get(t.artistId)?.name.toLowerCase().includes(q) ?? false)
      );
    }
    if (filters.genre && filters.genre !== 'All') list = list.filter((t) => t.genre === filters.genre);
    if (filters.mood && filters.mood !== 'all') list = list.filter((t) => t.mood === filters.mood);
    if (filters.instrumentalOnly) list = list.filter((t) => t.isInstrumental);
    if (filters.maxBpm !== undefined) list = list.filter((t) => t.bpm <= filters.maxBpm!);

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    return {
      items: list.slice(offset, offset + limit),
      meta: buildMeta(page, limit, list.length),
    };
  }

  async getAlbums(page = 1, limit = 20): Promise<PaginatedResult<Album>> {
    const snap = await this.getCatalogSnapshot();
    const offset = (page - 1) * limit;
    return {
      items: snap.albums.slice(offset, offset + limit),
      meta: buildMeta(page, limit, snap.albums.length),
    };
  }

  async getAlbumById(id: string) {
    const snap = await this.getCatalogSnapshot();
    const album = snap.albums.find((a) => a.id === id);
    if (!album) return null;
    return {
      album,
      artist: snap.artists.find((ar) => ar.id === album.artistId) ?? null,
      tracks: snap.tracks.filter((t) => t.albumId === album.id),
    };
  }

  async getArtists(page = 1, limit = 20): Promise<PaginatedResult<Artist>> {
    const snap = await this.getCatalogSnapshot();
    const offset = (page - 1) * limit;
    return {
      items: snap.artists.slice(offset, offset + limit),
      meta: buildMeta(page, limit, snap.artists.length),
    };
  }

  async getArtistById(id: string) {
    const snap = await this.getCatalogSnapshot();
    const artist = snap.artists.find((ar) => ar.id === id);
    if (!artist) return null;
    return {
      artist,
      albums: snap.albums.filter((a) => a.artistId === artist.id),
      tracks: snap.tracks.filter((t) => t.artistId === artist.id),
    };
  }

  async getTrackById(id: string): Promise<Track | null> {
    const snap = await this.getCatalogSnapshot();
    return snap.tracks.find((t) => t.id === id) ?? null;
  }

  async searchCatalog(input: {
    q: string;
    type: 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';
    page: number;
    limit: number;
    userId?: string | null;
  }) {
    const snap = await this.getCatalogSnapshot();
    const tracks = await this.getSongs({ q: input.q, page: input.page, limit: input.limit });
    const q = input.q.trim().toLowerCase();
    const artistMap = new Map(snap.artists.map((a) => [a.id, a]));
    const albums = q
      ? snap.albums.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.genre.toLowerCase().includes(q) ||
            (artistMap.get(a.artistId)?.name.toLowerCase().includes(q) ?? false)
        )
      : snap.albums;
    const artists = q
      ? snap.artists.filter(
          (ar) => ar.name.toLowerCase().includes(q) || ar.primaryGenre.toLowerCase().includes(q)
        )
      : snap.artists;
    const userPl = input.userId ? (await this.getPlaylists(input.userId, 1, 50)).items : [];
    const allPl = [...userPl, ...snap.editorialPlaylists];
    const playlists = q
      ? allPl.filter(
          (pl) => pl.title.toLowerCase().includes(q) || pl.description.toLowerCase().includes(q)
        )
      : allPl;
    return { tracks, albums, artists, playlists };
  }

  async getFavorites(userId: string, page = 1, limit = 50): Promise<PaginatedResult<string>> {
    const offset = (page - 1) * limit;
    const { data, count, error } = await this.client
      .from('favorites')
      .select('track_id', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return {
      items: (data ?? []).map((row) => row.track_id as string),
      meta: buildMeta(page, limit, count ?? 0),
    };
  }

  async addFavorite(userId: string, trackId: string): Promise<string[]> {
    const { error } = await this.client
      .from('favorites')
      .upsert({ user_id: userId, track_id: trackId }, { onConflict: 'user_id,track_id' });
    if (error) throw error;
    return (await this.getFavorites(userId, 1, 100)).items;
  }

  async removeFavorite(userId: string, trackId: string): Promise<string[]> {
    const { error } = await this.client
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('track_id', trackId);
    if (error) throw error;
    return (await this.getFavorites(userId, 1, 100)).items;
  }

  async getPlaylists(userId: string, page = 1, limit = 50): Promise<PaginatedResult<Playlist>> {
    const offset = (page - 1) * limit;
    const { data, count, error } = await this.client
      .from('playlists')
      .select('*, playlist_tracks(track_id, position)', { count: 'exact' })
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const items = (data ?? []).map((row) => {
      const tracks = ((row.playlist_tracks ?? []) as { track_id: string; position: number }[])
        .sort((a, b) => a.position - b.position)
        .map((t) => t.track_id);
      return {
        id: row.id as string,
        ownerId: row.owner_id as string,
        ownerName: 'You',
        title: row.title as string,
        description: (row.description as string) ?? '',
        coverUrl: (row.cover_url as string) ?? 'pl-low-light',
        isPublic: Boolean(row.is_public),
        trackIds: tracks,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    });

    return { items, meta: buildMeta(page, limit, count ?? items.length) };
  }

  async getPlaylistById(userId: string | null, playlistId: string): Promise<Playlist | null> {
    const { data, error } = await this.client
      .from('playlists')
      .select('*, playlist_tracks(track_id, position)')
      .eq('id', playlistId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (!data.is_public && data.owner_id !== userId) return null;

    const tracks = ((data.playlist_tracks ?? []) as { track_id: string; position: number }[])
      .sort((a, b) => a.position - b.position)
      .map((t) => t.track_id);

    return {
      id: data.id as string,
      ownerId: data.owner_id as string,
      ownerName: 'You',
      title: data.title as string,
      description: (data.description as string) ?? '',
      coverUrl: (data.cover_url as string) ?? 'pl-low-light',
      isPublic: Boolean(data.is_public),
      trackIds: tracks,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  async createPlaylist(
    userId: string,
    _ownerName: string,
    input: { title: string; description: string; isPublic: boolean; trackIds?: string[] }
  ): Promise<Playlist> {
    const { data, error } = await this.client
      .from('playlists')
      .insert({
        owner_id: userId,
        title: input.title.trim(),
        description: input.description.trim(),
        cover_url: 'pl-low-light',
        is_public: input.isPublic,
      })
      .select()
      .single();
    if (error) throw error;

    if (input.trackIds && input.trackIds.length > 0) {
      await this.client.from('playlist_tracks').insert(
        input.trackIds.map((tid, idx) => ({
          playlist_id: data.id,
          track_id: tid,
          position: idx,
        }))
      );
    }
    return (await this.getPlaylistById(userId, data.id as string))!;
  }

  async updatePlaylist(
    userId: string,
    playlistId: string,
    updates: { title?: string; description?: string; isPublic?: boolean }
  ): Promise<Playlist | null> {
    const { error } = await this.client
      .from('playlists')
      .update({
        ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
        ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
        ...(updates.isPublic !== undefined ? { is_public: updates.isPublic } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', playlistId)
      .eq('owner_id', userId);
    if (error) throw error;
    return this.getPlaylistById(userId, playlistId);
  }

  async deletePlaylist(userId: string, playlistId: string): Promise<boolean> {
    const { error } = await this.client
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('owner_id', userId);
    if (error) throw error;
    return true;
  }

  async addTrackToPlaylist(
    userId: string,
    playlistId: string,
    trackId: string
  ): Promise<Playlist | null> {
    const existing = await this.getPlaylistById(userId, playlistId);
    if (!existing || existing.ownerId !== userId) return null;

    await this.client.from('playlist_tracks').upsert(
      {
        playlist_id: playlistId,
        track_id: trackId,
        position: existing.trackIds.length,
      },
      { onConflict: 'playlist_id,track_id' }
    );
    return this.getPlaylistById(userId, playlistId);
  }

  async removeTrackFromPlaylist(
    userId: string,
    playlistId: string,
    trackId: string
  ): Promise<Playlist | null> {
    const existing = await this.getPlaylistById(userId, playlistId);
    if (!existing || existing.ownerId !== userId) return null;

    await this.client
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('track_id', trackId);
    return this.getPlaylistById(userId, playlistId);
  }

  async reorderPlaylistTracks(
    userId: string,
    playlistId: string,
    trackIds: string[]
  ): Promise<Playlist | null> {
    const existing = await this.getPlaylistById(userId, playlistId);
    if (!existing || existing.ownerId !== userId) return null;

    for (let i = 0; i < trackIds.length; i++) {
      await this.client
        .from('playlist_tracks')
        .update({ position: i })
        .eq('playlist_id', playlistId)
        .eq('track_id', trackIds[i]);
    }
    return this.getPlaylistById(userId, playlistId);
  }

  async getHistory(
    userId: string,
    page = 1,
    limit = 24
  ): Promise<PaginatedResult<PlayHistoryItem>> {
    const offset = (page - 1) * limit;
    const { data, count, error } = await this.client
      .from('play_history')
      .select('id, track_id, played_at, context_type, context_id', { count: 'exact' })
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const items = (data ?? []).map((r) => ({
      id: r.id as string,
      trackId: r.track_id as string,
      playedAt: r.played_at as string,
      contextType: r.context_type as PlayHistoryItem['contextType'],
      contextId: (r.context_id as string | null) ?? undefined,
    }));
    return { items, meta: buildMeta(page, limit, count ?? items.length) };
  }

  async recordHistory(
    userId: string,
    trackId: string,
    contextType: PlayHistoryItem['contextType'],
    contextId?: string
  ): Promise<PlayHistoryItem> {
    const { data, error } = await this.client
      .from('play_history')
      .insert({
        user_id: userId,
        track_id: trackId,
        context_type: contextType,
        context_id: contextId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      trackId: data.track_id as string,
      playedAt: data.played_at as string,
      contextType: data.context_type as PlayHistoryItem['contextType'],
      contextId: (data.context_id as string | null) ?? undefined,
    };
  }

  async getQueue(userId: string): Promise<QueueRecord | null> {
    const { data, error } = await this.client
      .from('playback_queues')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      currentTrackId: (data.current_track_id as string | null) ?? null,
      currentPositionMs: (data.current_position_ms as number) ?? 0,
      queueTrackIds: (data.queue_items as string[]) ?? [],
      shuffle: Boolean(data.shuffle_enabled),
      repeatMode: (data.repeat_mode as RepeatMode) ?? 'off',
    };
  }

  async saveQueue(userId: string, queue: QueueRecord): Promise<QueueRecord> {
    const { error } = await this.client.from('playback_queues').upsert({
      user_id: userId,
      current_track_id: queue.currentTrackId,
      current_position_ms: queue.currentPositionMs,
      queue_items: queue.queueTrackIds,
      shuffle_enabled: queue.shuffle,
      repeat_mode: queue.repeatMode,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return queue;
  }

  async getFocusSessions(
    userId: string,
    page = 1,
    limit = 100
  ): Promise<PaginatedResult<FocusSessionRecord>> {
    const offset = (page - 1) * limit;
    const { data, count, error } = await this.client
      .from('focus_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const items = (data ?? []).map((r) => ({
      id: r.id as string,
      mode: r.mode as FocusSessionRecord['mode'],
      focusDurationMin: r.focus_duration_min as number,
      breakDurationMin: r.break_duration_min as number,
      completedCycles: r.completed_cycles as number,
      targetCycles: r.target_cycles as number,
      targetMood: r.target_mood as FocusSessionRecord['targetMood'],
      startedAt: r.started_at as string,
      endedAt: (r.ended_at as string | null) ?? undefined,
      status: r.status as FocusSessionRecord['status'],
    }));
    return { items, meta: buildMeta(page, limit, count ?? items.length) };
  }

  async recordFocusSession(
    userId: string,
    session: Omit<FocusSessionRecord, 'id'>
  ): Promise<FocusSessionRecord> {
    const endedAt = session.endedAt ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('focus_sessions')
      .insert({
        user_id: userId,
        mode: session.mode,
        focus_duration_min: session.focusDurationMin,
        break_duration_min: session.breakDurationMin,
        completed_cycles: session.completedCycles,
        target_cycles: session.targetCycles,
        target_mood: session.targetMood,
        started_at: session.startedAt,
        ended_at: endedAt,
        status: session.status,
      })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id as string, ...session, endedAt };
  }

  async getMemoryTags(userId: string): Promise<UserTag[]> {
    const { data, error } = await this.client
      .from('user_tags')
      .select('id, name, color_hex')
      .eq('user_id', userId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      colorHex: r.color_hex as string,
    }));
  }

  async createMemoryTag(userId: string, name: string, colorHex: string): Promise<UserTag> {
    const cleanName = name.trim();
    const { data: existing } = await this.client
      .from('user_tags')
      .select('id, name, color_hex')
      .eq('user_id', userId)
      .ilike('name', cleanName)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id as string,
        name: existing.name as string,
        colorHex: existing.color_hex as string,
      };
    }

    const { data, error } = await this.client
      .from('user_tags')
      .insert({ user_id: userId, name: cleanName, color_hex: colorHex })
      .select('id, name, color_hex')
      .single();
    if (error) throw error;
    return {
      id: data.id as string,
      name: data.name as string,
      colorHex: data.color_hex as string,
    };
  }

  async deleteMemoryTag(userId: string, tagId: string): Promise<boolean> {
    const { error } = await this.client
      .from('user_tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
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
    const { data, error } = await this.client
      .from('memory_notes')
      .select('*, memory_note_tags(tag_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    let mapped: MemoryNote[] = (data ?? []).map((r) => ({
      id: r.id as string,
      trackId: r.track_id as string,
      timestampMs: r.timestamp_ms as number,
      noteText: r.note_text as string,
      isBookmark: Boolean(r.is_bookmark),
      tagIds: ((r.memory_note_tags ?? []) as { tag_id: string }[]).map((t) => t.tag_id),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

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

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;
    return {
      items: mapped.slice(offset, offset + limit),
      meta: buildMeta(page, limit, mapped.length),
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

    if (input.isBookmark) {
      const { data: existing } = await this.client
        .from('memory_notes')
        .select('id, note_text')
        .eq('user_id', userId)
        .eq('track_id', input.trackId)
        .eq('is_bookmark', true)
        .gte('timestamp_ms', bucketStart)
        .lte('timestamp_ms', bucketEnd)
        .maybeSingle();

      if (existing) {
        const updated = await this.updateMemoryNote(userId, existing.id as string, {
          noteText: input.noteText.trim() || (existing.note_text as string),
          tagIds: input.tagIds.length > 0 ? input.tagIds : undefined,
        });
        return { note: updated!, deduplicated: true };
      }
    }

    const { data, error } = await this.client
      .from('memory_notes')
      .insert({
        user_id: userId,
        track_id: input.trackId,
        timestamp_ms: safeTimestamp,
        note_text: input.noteText.trim(),
        is_bookmark: input.isBookmark,
      })
      .select()
      .single();
    if (error) throw error;

    if (input.tagIds.length > 0) {
      await this.client.from('memory_note_tags').insert(
        input.tagIds.map((tagId) => ({ note_id: data.id, tag_id: tagId }))
      );
    }

    if (input.isBookmark) {
      await this.upsertTimestampBookmark(userId, {
        trackId: input.trackId,
        timestampMs: safeTimestamp,
        label: input.noteText.trim(),
      });
    }

    const notes = await this.getMemoryNotes(userId);
    const created = notes.items.find((n) => n.id === data.id)!;
    return { note: created, deduplicated: false };
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
    const { data: existing } = await this.client
      .from('memory_notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing) return null;

    await this.client
      .from('memory_notes')
      .update({
        ...(updates.noteText !== undefined ? { note_text: updates.noteText.trim() } : {}),
        ...(updates.isBookmark !== undefined ? { is_bookmark: updates.isBookmark } : {}),
        ...(updates.timestampMs !== undefined
          ? { timestamp_ms: Math.max(0, Math.round(updates.timestampMs)) }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .eq('user_id', userId);

    if (updates.tagIds !== undefined) {
      await this.client.from('memory_note_tags').delete().eq('note_id', noteId);
      if (updates.tagIds.length > 0) {
        await this.client.from('memory_note_tags').insert(
          updates.tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId }))
        );
      }
    }

    const notes = await this.getMemoryNotes(userId);
    return notes.items.find((n) => n.id === noteId) ?? null;
  }

  async deleteMemoryNote(userId: string, noteId: string): Promise<boolean> {
    const { error } = await this.client
      .from('memory_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }

  async getTimestampBookmarks(userId: string, trackId?: string): Promise<TimestampBookmark[]> {
    let query = this.client
      .from('timestamp_bookmarks')
      .select('id, track_id, timestamp_ms, label, created_at')
      .eq('user_id', userId);
    if (trackId) query = query.eq('track_id', trackId);
    const { data, error } = await query.order('timestamp_ms', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      trackId: r.track_id as string,
      timestampMs: r.timestamp_ms as number,
      label: r.label as string,
      createdAt: r.created_at as string,
    }));
  }

  async upsertTimestampBookmark(
    userId: string,
    input: { trackId: string; timestampMs: number; label: string }
  ): Promise<{ bookmark: TimestampBookmark; deduplicated: boolean }> {
    const safeTs = Math.max(0, Math.round(input.timestampMs));
    const bucketStart = Math.floor(safeTs / 1000) * 1000;
    const bucketEnd = bucketStart + 999;

    const { data: existing } = await this.client
      .from('timestamp_bookmarks')
      .select('id, track_id, timestamp_ms, label, created_at')
      .eq('user_id', userId)
      .eq('track_id', input.trackId)
      .gte('timestamp_ms', bucketStart)
      .lte('timestamp_ms', bucketEnd)
      .maybeSingle();

    if (existing) {
      const nextLabel = input.label.trim() || (existing.label as string);
      await this.client
        .from('timestamp_bookmarks')
        .update({ label: nextLabel })
        .eq('id', existing.id)
        .eq('user_id', userId);
      return {
        bookmark: {
          id: existing.id as string,
          trackId: existing.track_id as string,
          timestampMs: existing.timestamp_ms as number,
          label: nextLabel,
          createdAt: existing.created_at as string,
        },
        deduplicated: true,
      };
    }

    const { data, error } = await this.client
      .from('timestamp_bookmarks')
      .insert({
        user_id: userId,
        track_id: input.trackId,
        timestamp_ms: safeTs,
        label: input.label.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return {
      bookmark: {
        id: data.id as string,
        trackId: data.track_id as string,
        timestampMs: data.timestamp_ms as number,
        label: data.label as string,
        createdAt: data.created_at as string,
      },
      deduplicated: false,
    };
  }

  async deleteTimestampBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    const { error } = await this.client
      .from('timestamp_bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }
}
