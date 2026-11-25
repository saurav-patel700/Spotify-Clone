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

export interface QueueRecord {
  currentTrackId: string | null;
  currentPositionMs: number;
  queueTrackIds: string[];
  shuffle: boolean;
  repeatMode: RepeatMode;
}

export interface AuthSessionResult {
  user: UserProfile;
  accessToken: string;
  expiresAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface CatalogFilters {
  q?: string;
  genre?: string;
  mood?: string;
  instrumentalOnly?: boolean;
  maxBpm?: number;
  page?: number;
  limit?: number;
}

export interface DatabaseRepository {
  readonly kind: 'sqlite' | 'supabase';

  // --- Auth & Profiles ---
  signup(input: { displayName: string; email: string; password: string }): Promise<AuthSessionResult>;
  login(input: { email: string; password: string }): Promise<AuthSessionResult | null>;
  logout(token: string): Promise<void>;
  isTokenRevoked(jti: string): Promise<boolean>;
  createPasswordReset(email: string): Promise<{ resetToken: string | null; expiresAt: string }>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  getProfileById(userId: string): Promise<UserProfile | null>;
  updateProfile(
    userId: string,
    updates: {
      displayName: string;
      preferredFocusMinutes: number;
      preferredBreakMinutes: number;
      preferredLongBreakMinutes: number;
    }
  ): Promise<UserProfile | null>;

  // --- Catalog & Discovery (real DB queries) ---
  getCatalogSnapshot(): Promise<{
    artists: Artist[];
    albums: Album[];
    tracks: Track[];
    editorialPlaylists: Playlist[];
  }>;
  getSongs(filters: CatalogFilters): Promise<PaginatedResult<Track>>;
  getAlbums(page?: number, limit?: number): Promise<PaginatedResult<Album>>;
  getAlbumById(id: string): Promise<{ album: Album; artist: Artist | null; tracks: Track[] } | null>;
  getArtists(page?: number, limit?: number): Promise<PaginatedResult<Artist>>;
  getArtistById(id: string): Promise<{ artist: Artist; albums: Album[]; tracks: Track[] } | null>;
  getTrackById(id: string): Promise<Track | null>;
  searchCatalog(input: {
    q: string;
    type: 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';
    page: number;
    limit: number;
    userId?: string | null;
  }): Promise<{
    tracks: PaginatedResult<Track>;
    albums: Album[];
    artists: Artist[];
    playlists: Playlist[];
  }>;

  // --- Favorites ---
  getFavorites(userId: string, page?: number, limit?: number): Promise<PaginatedResult<string>>;
  addFavorite(userId: string, trackId: string): Promise<string[]>;
  removeFavorite(userId: string, trackId: string): Promise<string[]>;

  // --- Playlists ---
  getPlaylists(userId: string, page?: number, limit?: number): Promise<PaginatedResult<Playlist>>;
  getPlaylistById(userId: string | null, playlistId: string): Promise<Playlist | null>;
  createPlaylist(
    userId: string,
    ownerName: string,
    input: { title: string; description: string; isPublic: boolean; trackIds?: string[] }
  ): Promise<Playlist>;
  updatePlaylist(
    userId: string,
    playlistId: string,
    updates: { title?: string; description?: string; isPublic?: boolean }
  ): Promise<Playlist | null>;
  deletePlaylist(userId: string, playlistId: string): Promise<boolean>;
  addTrackToPlaylist(userId: string, playlistId: string, trackId: string): Promise<Playlist | null>;
  removeTrackFromPlaylist(userId: string, playlistId: string, trackId: string): Promise<Playlist | null>;
  reorderPlaylistTracks(userId: string, playlistId: string, trackIds: string[]): Promise<Playlist | null>;

  // --- History & Queue ---
  getHistory(userId: string, page?: number, limit?: number): Promise<PaginatedResult<PlayHistoryItem>>;
  recordHistory(
    userId: string,
    trackId: string,
    contextType: PlayHistoryItem['contextType'],
    contextId?: string
  ): Promise<PlayHistoryItem>;
  getQueue(userId: string): Promise<QueueRecord | null>;
  saveQueue(userId: string, queue: QueueRecord): Promise<QueueRecord>;

  // --- FocusFlow ---
  getFocusSessions(userId: string, page?: number, limit?: number): Promise<PaginatedResult<FocusSessionRecord>>;
  recordFocusSession(
    userId: string,
    session: Omit<FocusSessionRecord, 'id'>
  ): Promise<FocusSessionRecord>;

  // --- MemoryMix (Notes, Bookmarks, Tags) ---
  getMemoryTags(userId: string): Promise<UserTag[]>;
  createMemoryTag(userId: string, name: string, colorHex: string): Promise<UserTag>;
  deleteMemoryTag(userId: string, tagId: string): Promise<boolean>;

  getMemoryNotes(
    userId: string,
    filters?: {
      q?: string;
      tagId?: string;
      trackId?: string;
      bookmarksOnly?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResult<MemoryNote>>;
  upsertMemoryNote(
    userId: string,
    input: {
      trackId: string;
      timestampMs: number;
      noteText: string;
      isBookmark: boolean;
      tagIds: string[];
    }
  ): Promise<{ note: MemoryNote; deduplicated: boolean }>;
  updateMemoryNote(
    userId: string,
    noteId: string,
    updates: {
      noteText?: string;
      isBookmark?: boolean;
      timestampMs?: number;
      tagIds?: string[];
    }
  ): Promise<MemoryNote | null>;
  deleteMemoryNote(userId: string, noteId: string): Promise<boolean>;

  getTimestampBookmarks(userId: string, trackId?: string): Promise<TimestampBookmark[]>;
  upsertTimestampBookmark(
    userId: string,
    input: { trackId: string; timestampMs: number; label: string }
  ): Promise<{ bookmark: TimestampBookmark; deduplicated: boolean }>;
  deleteTimestampBookmark(userId: string, bookmarkId: string): Promise<boolean>;
}
