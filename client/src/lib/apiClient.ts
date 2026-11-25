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
import { getArtworkUrl } from './artwork';

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const API_BASE = configuredBase ? configuredBase.replace(/\/+$/, '') : '/api/v1';

export function resolveApiAssetUrl(assetPath: string): string {
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  if (/^https?:\/\//i.test(API_BASE)) {
    const origin = new URL(API_BASE).origin;
    return `${origin}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
  }
  return assetPath;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('soundsphere-auth-v2');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    meta?: PaginatedMeta;
    error?: { code?: string; message?: string };
  };

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload.error?.code ?? 'REQUEST_FAILED',
      payload.error?.message ?? `Request failed (${response.status})`
    );
  }

  return payload.data as T;
}

function normalizeArtwork(keyOrUrl: string): string {
  if (!keyOrUrl) return getArtworkUrl('pl-low-light');
  if (keyOrUrl.startsWith('data:') || keyOrUrl.startsWith('http')) return keyOrUrl;
  return getArtworkUrl(keyOrUrl);
}

function normalizePlaylist(pl: Playlist): Playlist {
  return { ...pl, coverUrl: normalizeArtwork(pl.coverUrl) };
}

function normalizeAlbum(album: Album): Album {
  return { ...album, coverUrl: normalizeArtwork(album.coverUrl) };
}

function normalizeArtist(artist: Artist): Artist {
  return { ...artist, artworkUrl: normalizeArtwork(artist.artworkUrl) };
}

export const apiClient = {
  // --- Auth & Profile ---
  signup(input: { displayName: string; email: string; password: string }) {
    return request<{ user: UserProfile; accessToken: string; expiresAt: string }>(
      '/auth/signup',
      { method: 'POST', body: JSON.stringify(input) }
    );
  },

  login(input: { email: string; password: string }) {
    return request<{ user: UserProfile; accessToken: string; expiresAt: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(input) }
    );
  },

  logout() {
    return request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' });
  },

  forgotPassword(email: string) {
    return request<{ message: string; expiresAt: string; resetToken?: string }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
  },

  resetPassword(token: string, newPassword: string) {
    return request<{ reset: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  getMe() {
    return request<{ user: UserProfile }>('/auth/me');
  },

  updateMe(updates: {
    displayName: string;
    preferredFocusMinutes: number;
    preferredBreakMinutes: number;
    preferredLongBreakMinutes: number;
  }) {
    return request<{ user: UserProfile }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // --- Catalog ---
  async getCatalogSnapshot(): Promise<{
    artists: Artist[];
    albums: Album[];
    tracks: Track[];
    editorialPlaylists: Playlist[];
  }> {
    const data = await request<{
      artists: Artist[];
      albums: Album[];
      tracks: Track[];
      editorialPlaylists: Playlist[];
    }>('/catalog');
    return {
      artists: data.artists.map(normalizeArtist),
      albums: data.albums.map(normalizeAlbum),
      tracks: data.tracks,
      editorialPlaylists: data.editorialPlaylists.map(normalizePlaylist),
    };
  },

  getStreamInfo(trackId: string) {
    return request<{
      trackId: string;
      streamUrl: string;
      durationMs: number;
      licenseType: string;
      attributionText: string;
    }>(`/tracks/${encodeURIComponent(trackId)}/stream`);
  },

  // --- Favorites ---
  async getFavorites(): Promise<string[]> {
    const data = await request<{ trackIds: string[] }>('/favorites');
    return data.trackIds;
  },

  async addFavorite(trackId: string): Promise<string[]> {
    const data = await request<{ trackIds: string[] }>(
      `/favorites/${encodeURIComponent(trackId)}`,
      { method: 'POST' }
    );
    return data.trackIds;
  },

  async removeFavorite(trackId: string): Promise<string[]> {
    const data = await request<{ trackIds: string[] }>(
      `/favorites/${encodeURIComponent(trackId)}`,
      { method: 'DELETE' }
    );
    return data.trackIds;
  },

  // --- Playlists ---
  async getPlaylists(): Promise<Playlist[]> {
    const data = await request<{ playlists: Playlist[] }>('/playlists');
    return data.playlists.map(normalizePlaylist);
  },

  async getPlaylistById(id: string): Promise<Playlist> {
    const data = await request<{ playlist: Playlist }>(
      `/playlists/${encodeURIComponent(id)}`
    );
    return normalizePlaylist(data.playlist);
  },

  async createPlaylist(input: {
    title: string;
    description: string;
    isPublic?: boolean;
    trackIds?: string[];
  }): Promise<Playlist> {
    const data = await request<{ playlist: Playlist }>('/playlists', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return normalizePlaylist(data.playlist);
  },

  async updatePlaylist(
    id: string,
    updates: { title?: string; description?: string; isPublic?: boolean }
  ): Promise<Playlist> {
    const data = await request<{ playlist: Playlist }>(
      `/playlists/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return normalizePlaylist(data.playlist);
  },

  async deletePlaylist(id: string): Promise<void> {
    await request<{ deleted: boolean }>(`/playlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist> {
    const data = await request<{ playlist: Playlist }>(
      `/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        method: 'POST',
        body: JSON.stringify({ trackId }),
      }
    );
    return normalizePlaylist(data.playlist);
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<Playlist> {
    const data = await request<{ playlist: Playlist }>(
      `/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
      { method: 'DELETE' }
    );
    return normalizePlaylist(data.playlist);
  },

  async reorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<Playlist> {
    const data = await request<{ playlist: Playlist }>(
      `/playlists/${encodeURIComponent(playlistId)}/tracks/reorder`,
      {
        method: 'PATCH',
        body: JSON.stringify({ trackIds }),
      }
    );
    return normalizePlaylist(data.playlist);
  },

  // --- History & Queue ---
  async getHistory(limit = 24): Promise<PlayHistoryItem[]> {
    const data = await request<{ items: PlayHistoryItem[] }>(`/history?limit=${limit}`);
    return data.items;
  },

  async recordHistory(
    trackId: string,
    contextType: PlayHistoryItem['contextType'],
    contextId?: string
  ): Promise<PlayHistoryItem> {
    const data = await request<{ item: PlayHistoryItem }>('/history', {
      method: 'POST',
      body: JSON.stringify({ trackId, contextType, contextId }),
    });
    return data.item;
  },

  async saveQueue(queue: {
    currentTrackId: string | null;
    currentPositionMs: number;
    queueTrackIds: string[];
    shuffle: boolean;
    repeatMode: RepeatMode;
  }): Promise<void> {
    await request('/queue', {
      method: 'PUT',
      body: JSON.stringify(queue),
    });
  },

  // --- FocusFlow ---
  async getFocusSessions(limit = 100): Promise<FocusSessionRecord[]> {
    const data = await request<{ sessions: FocusSessionRecord[] }>(`/focus/sessions?limit=${limit}`);
    return data.sessions;
  },

  async recordFocusSession(
    session: Omit<FocusSessionRecord, 'id'>
  ): Promise<FocusSessionRecord> {
    const data = await request<{ session: FocusSessionRecord }>('/focus/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
    return data.session;
  },

  // --- MemoryMix ---
  async getMemoryJournal(): Promise<{
    notes: MemoryNote[];
    tags: UserTag[];
    bookmarks: TimestampBookmark[];
  }> {
    return request<{
      notes: MemoryNote[];
      tags: UserTag[];
      bookmarks: TimestampBookmark[];
    }>('/memory');
  },

  async upsertMemoryNote(input: {
    trackId: string;
    timestampMs: number;
    noteText: string;
    isBookmark: boolean;
    tagIds: string[];
  }): Promise<{ note: MemoryNote; deduplicated: boolean }> {
    return request<{ note: MemoryNote; deduplicated: boolean }>('/memory', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateMemoryNote(
    id: string,
    updates: {
      noteText?: string;
      isBookmark?: boolean;
      timestampMs?: number;
      tagIds?: string[];
    }
  ): Promise<MemoryNote> {
    const data = await request<{ note: MemoryNote }>(
      `/memory/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return data.note;
  },

  async deleteMemoryNote(id: string): Promise<void> {
    await request(`/memory/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async createMemoryTag(name: string, colorHex: string): Promise<UserTag> {
    const data = await request<{ tag: UserTag }>('/memory/tags', {
      method: 'POST',
      body: JSON.stringify({ name, colorHex }),
    });
    return data.tag;
  },

  async deleteMemoryTag(id: string): Promise<void> {
    await request(`/memory/tags/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
