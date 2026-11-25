import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Playlist } from '@soundsphere/shared';
import { getArtworkUrl } from '@/lib/artwork';
import { apiClient } from '@/lib/apiClient';
import { useCatalogStore } from './useCatalogStore';
import { useAuthStore } from './useAuthStore';

interface LibraryState {
  favoriteTrackIds: string[];
  savedAlbumIds: string[];
  userPlaylists: Playlist[];
  isLoading: boolean;
  syncError: string | null;

  hydrateFromServer: () => Promise<void>;
  clearLibrary: () => void;
  clearSyncError: () => void;
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  toggleSavedAlbum: (albumId: string) => void;
  createPlaylist: (title: string, description?: string, initialTrackId?: string) => Playlist;
  updatePlaylist: (id: string, updates: { title?: string; description?: string; isPublic?: boolean }) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  moveTrackInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  getPlaylistById: (id: string) => Playlist | undefined;
}

const COVER_KEYS = ['pl-deep-work', 'pl-late-night', 'pl-acoustic-morning', 'pl-low-light'];

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      favoriteTrackIds: [],
      savedAlbumIds: [],
      userPlaylists: [],
      isLoading: false,
      syncError: null,

      hydrateFromServer: async () => {
        if (!useAuthStore.getState().accessToken) {
          set({ favoriteTrackIds: [], userPlaylists: [], isLoading: false });
          return;
        }
        set({ isLoading: true, syncError: null });
        try {
          const [favs, playlists] = await Promise.all([
            apiClient.getFavorites(),
            apiClient.getPlaylists(),
          ]);
          set({
            favoriteTrackIds: favs,
            userPlaylists: playlists,
            isLoading: false,
          });
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Unable to load your library from database.';
          set({ isLoading: false, syncError: msg });
        }
      },

      clearLibrary: () =>
        set({
          favoriteTrackIds: [],
          savedAlbumIds: [],
          userPlaylists: [],
          syncError: null,
        }),

      clearSyncError: () => set({ syncError: null }),

      toggleFavorite: (trackId) => {
        const previous = get().favoriteTrackIds;
        const exists = previous.includes(trackId);
        const optimistic = exists
          ? previous.filter((id) => id !== trackId)
          : [trackId, ...previous];

        set({ favoriteTrackIds: optimistic, syncError: null });

        if (!useAuthStore.getState().accessToken) return;

        const req = exists
          ? apiClient.removeFavorite(trackId)
          : apiClient.addFavorite(trackId);

        void req
          .then((serverFavs) => {
            set({ favoriteTrackIds: serverFavs });
          })
          .catch(() => {
            set({
              favoriteTrackIds: previous,
              syncError: 'Could not update favorite in database.',
            });
          });
      },

      isFavorite: (trackId) => get().favoriteTrackIds.includes(trackId),

      toggleSavedAlbum: (albumId) => {
        set((state) => {
          const exists = state.savedAlbumIds.includes(albumId);
          return {
            savedAlbumIds: exists
              ? state.savedAlbumIds.filter((id) => id !== albumId)
              : [albumId, ...state.savedAlbumIds],
          };
        });
      },

      createPlaylist: (title, description = '', initialTrackId) => {
        const user = useAuthStore.getState().user;
        const idx = get().userPlaylists.length % COVER_KEYS.length;
        const now = new Date().toISOString();
        const tempId = `upl-${crypto.randomUUID().slice(0, 8)}`;
        const playlist: Playlist = {
          id: tempId,
          ownerId: user?.id ?? 'local',
          ownerName: user?.displayName ?? 'You',
          title: title.trim(),
          description: description.trim(),
          coverUrl: getArtworkUrl(COVER_KEYS[idx]),
          isPublic: false,
          trackIds: initialTrackId ? [initialTrackId] : [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          userPlaylists: [playlist, ...state.userPlaylists],
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .createPlaylist({
              title: playlist.title,
              description: playlist.description,
              isPublic: false,
              trackIds: playlist.trackIds,
            })
            .then((serverPlaylist) => {
              set((state) => ({
                userPlaylists: state.userPlaylists.map((p) =>
                  p.id === tempId ? serverPlaylist : p
                ),
              }));
            })
            .catch(() => {
              set({ syncError: 'Could not save playlist to database.' });
            });
        }

        return playlist;
      },

      updatePlaylist: (id, updates) => {
        const previous = get().userPlaylists;
        set((state) => ({
          userPlaylists: state.userPlaylists.map((pl) =>
            pl.id === id
              ? {
                  ...pl,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : pl
          ),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .updatePlaylist(id, updates)
            .then((serverPl) => {
              set((state) => ({
                userPlaylists: state.userPlaylists.map((p) => (p.id === id ? serverPl : p)),
              }));
            })
            .catch(() => {
              set({
                userPlaylists: previous,
                syncError: 'Could not update playlist in database.',
              });
            });
        }
      },

      deletePlaylist: (id) => {
        const previous = get().userPlaylists;
        set((state) => ({
          userPlaylists: state.userPlaylists.filter((pl) => pl.id !== id),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient.deletePlaylist(id).catch(() => {
            set({
              userPlaylists: previous,
              syncError: 'Could not delete playlist from database.',
            });
          });
        }
      },

      addTrackToPlaylist: (playlistId, trackId) => {
        const previous = get().userPlaylists;
        set((state) => ({
          userPlaylists: state.userPlaylists.map((pl) => {
            if (pl.id !== playlistId) return pl;
            if (pl.trackIds.includes(trackId)) return pl;
            return {
              ...pl,
              trackIds: [...pl.trackIds, trackId],
              updatedAt: new Date().toISOString(),
            };
          }),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .addTrackToPlaylist(playlistId, trackId)
            .then((serverPl) => {
              set((state) => ({
                userPlaylists: state.userPlaylists.map((p) =>
                  p.id === playlistId ? serverPl : p
                ),
              }));
            })
            .catch(() => {
              set({
                userPlaylists: previous,
                syncError: 'Could not add track to playlist in database.',
              });
            });
        }
      },

      removeTrackFromPlaylist: (playlistId, trackId) => {
        const previous = get().userPlaylists;
        set((state) => ({
          userPlaylists: state.userPlaylists.map((pl) =>
            pl.id === playlistId
              ? {
                  ...pl,
                  trackIds: pl.trackIds.filter((id) => id !== trackId),
                  updatedAt: new Date().toISOString(),
                }
              : pl
          ),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .removeTrackFromPlaylist(playlistId, trackId)
            .then((serverPl) => {
              set((state) => ({
                userPlaylists: state.userPlaylists.map((p) =>
                  p.id === playlistId ? serverPl : p
                ),
              }));
            })
            .catch(() => {
              set({
                userPlaylists: previous,
                syncError: 'Could not remove track from playlist in database.',
              });
            });
        }
      },

      moveTrackInPlaylist: (playlistId, fromIndex, toIndex) => {
        const previous = get().userPlaylists;
        let nextOrder: string[] = [];

        set((state) => ({
          userPlaylists: state.userPlaylists.map((pl) => {
            if (pl.id !== playlistId) return pl;
            if (
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= pl.trackIds.length ||
              toIndex >= pl.trackIds.length
            ) {
              return pl;
            }
            const next = [...pl.trackIds];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            nextOrder = next;
            return {
              ...pl,
              trackIds: next,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        if (nextOrder.length > 0 && useAuthStore.getState().accessToken) {
          void apiClient.reorderPlaylistTracks(playlistId, nextOrder).catch(() => {
            set({
              userPlaylists: previous,
              syncError: 'Could not save playlist order to database.',
            });
          });
        }
      },

      getPlaylistById: (id) => {
        return (
          get().userPlaylists.find((p) => p.id === id) ??
          useCatalogStore.getState().editorialPlaylists.find((p) => p.id === id)
        );
      },
    }),
    {
      name: 'soundsphere-library-v2',
      partialize: (state) => ({
        savedAlbumIds: state.savedAlbumIds,
      }),
    }
  )
);
