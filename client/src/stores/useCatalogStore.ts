import { create } from 'zustand';
import type { Album, Artist, Playlist, Track } from '@soundsphere/shared';
import { apiClient } from '@/lib/apiClient';

interface CatalogState {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  editorialPlaylists: Playlist[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;

  hydrateCatalog: () => Promise<void>;
  getArtistById: (id: string) => Artist | undefined;
  getAlbumById: (id: string) => Album | undefined;
  getTrackById: (id: string) => Track | undefined;
  getTracksByAlbum: (albumId: string) => Track[];
  getTracksByArtist: (artistId: string) => Track[];
  getAlbumsByArtist: (artistId: string) => Album[];
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  artists: [],
  albums: [],
  tracks: [],
  editorialPlaylists: [],
  isLoading: false,
  hasLoaded: false,
  error: null,

  hydrateCatalog: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const snap = await apiClient.getCatalogSnapshot();
      set({
        artists: snap.artists,
        albums: snap.albums,
        tracks: snap.tracks,
        editorialPlaylists: snap.editorialPlaylists,
        isLoading: false,
        hasLoaded: true,
        error: null,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to load music catalog from server.';
      set({ isLoading: false, error: msg });
    }
  },

  getArtistById: (id) => get().artists.find((a) => a.id === id),
  getAlbumById: (id) => get().albums.find((a) => a.id === id),
  getTrackById: (id) => get().tracks.find((t) => t.id === id),
  getTracksByAlbum: (albumId) =>
    get()
      .tracks.filter((t) => t.albumId === albumId)
      .sort((a, b) => a.trackNumber - b.trackNumber),
  getTracksByArtist: (artistId) => get().tracks.filter((t) => t.artistId === artistId),
  getAlbumsByArtist: (artistId) => get().albums.filter((a) => a.artistId === artistId),
}));
