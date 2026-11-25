import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayHistoryItem, RepeatMode } from '@soundsphere/shared';
import { audioEngine, type AudioEngineStatus } from '@/lib/audioEngine';
import { apiClient } from '@/lib/apiClient';
import { useCatalogStore } from './useCatalogStore';
import { useAuthStore } from './useAuthStore';

interface PlayerState {
  currentTrackId: string | null;
  queueTrackIds: string[];
  queueIndex: number;
  isPlaying: boolean;
  audioStatus: AudioEngineStatus;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  recentlyPlayed: PlayHistoryItem[];
  isQueueOpen: boolean;
  isMobileSheetOpen: boolean;
  audioError: string | null;

  initEngine: () => void;
  hydrateHistory: () => Promise<void>;
  clearUserHistory: () => void;
  playTrack: (
    trackId: string,
    context?: PlayHistoryItem['contextType'],
    contextId?: string,
    startMs?: number
  ) => void;
  playCollection: (
    trackIds: string[],
    startIndex?: number,
    context?: PlayHistoryItem['contextType'],
    contextId?: string
  ) => void;
  togglePlayPause: () => void;
  retryCurrentTrack: () => void;
  clearAudioError: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (ms: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (trackId: string) => void;
  playNext: (trackId: string) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearUpcomingQueue: () => void;
  setQueueOpen: (open: boolean) => void;
  toggleQueueOpen: () => void;
  setMobileSheetOpen: (open: boolean) => void;
}

let engineInitialized = false;

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      const getTrack = (id: string) => useCatalogStore.getState().getTrackById(id);

      const syncQueueToServer = () => {
        if (!useAuthStore.getState().accessToken) return;
        const s = get();
        void apiClient
          .saveQueue({
            currentTrackId: s.currentTrackId,
            currentPositionMs: Math.round(s.currentTimeMs),
            queueTrackIds: s.queueTrackIds,
            shuffle: s.shuffle,
            repeatMode: s.repeatMode,
          })
          .catch(() => {
            // Queue sync is best-effort
          });
      };

      const recordHistory = (
        trackId: string,
        contextType: PlayHistoryItem['contextType'] = 'direct',
        contextId?: string
      ) => {
        set((state) => {
          const entry: PlayHistoryItem = {
            id: `hist-${crypto.randomUUID().slice(0, 8)}`,
            trackId,
            playedAt: new Date().toISOString(),
            contextType,
            contextId,
          };
          const filtered = state.recentlyPlayed.filter((item) => item.trackId !== trackId);
          return {
            recentlyPlayed: [entry, ...filtered].slice(0, 24),
          };
        });

        if (useAuthStore.getState().accessToken) {
          void apiClient.recordHistory(trackId, contextType, contextId).catch(() => {});
        }
      };

      const startPlaybackAt = (trackId: string, startMs = 0, forceReload = false) => {
        const track = getTrack(trackId);
        if (!track) {
          set({
            audioStatus: 'error',
            isPlaying: false,
            audioError: 'Selected track is unavailable in the catalog.',
          });
          return;
        }
        set({
          currentTrackId: track.id,
          durationMs: track.durationMs,
          currentTimeMs: startMs,
          audioError: null,
          audioStatus: 'loading',
        });
        audioEngine.setVolume(get().volume, get().muted);
        void audioEngine.loadAndPlay(track, startMs, forceReload);
        syncQueueToServer();
      };

      return {
        currentTrackId: null,
        queueTrackIds: [],
        queueIndex: 0,
        isPlaying: false,
        audioStatus: 'idle',
        currentTimeMs: 0,
        durationMs: 0,
        volume: 0.75,
        muted: false,
        shuffle: false,
        repeatMode: 'off',
        recentlyPlayed: [],
        isQueueOpen: false,
        isMobileSheetOpen: false,
        audioError: null,

        initEngine: () => {
          if (engineInitialized) return;
          engineInitialized = true;
          audioEngine.setVolume(get().volume, get().muted);
          audioEngine.bindCallbacks({
            onTimeUpdate: (currentTimeMs, durationMs) => {
              const current = get().currentTrackId
                ? getTrack(get().currentTrackId!)
                : undefined;
              set({
                currentTimeMs,
                durationMs: durationMs > 0 ? durationMs : current?.durationMs ?? get().durationMs,
              });
            },
            onStatusChange: (status, errorMessage) => {
              set({
                audioStatus: status,
                isPlaying: status === 'playing',
                ...(errorMessage !== undefined ? { audioError: errorMessage } : {}),
              });
            },
            onEnded: () => {
              const state = get();
              if (state.repeatMode === 'one' && state.currentTrackId) {
                startPlaybackAt(state.currentTrackId, 0);
                return;
              }
              state.nextTrack();
            },
          });
        },

        hydrateHistory: async () => {
          if (!useAuthStore.getState().accessToken) return;
          try {
            const serverItems = await apiClient.getHistory(24);
            const seen = new Set<string>();
            const deduped: PlayHistoryItem[] = [];
            for (const item of serverItems) {
              if (!seen.has(item.trackId)) {
                seen.add(item.trackId);
                deduped.push(item);
              }
            }
            set({ recentlyPlayed: deduped });
          } catch {
            // Keep existing local session history if offline
          }
        },

        clearUserHistory: () => set({ recentlyPlayed: [] }),

        playTrack: (trackId, context = 'direct', contextId, startMs = 0) => {
          const track = getTrack(trackId);
          if (!track) {
            set({
              audioStatus: 'error',
              isPlaying: false,
              audioError: `Track "${trackId}" is unavailable.`,
            });
            return;
          }
          const state = get();
          const existingIdx = state.queueTrackIds.indexOf(trackId);
          if (existingIdx !== -1) {
            set({ queueIndex: existingIdx });
          } else {
            const nextQueue = [...state.queueTrackIds];
            const insertAt = Math.min(nextQueue.length, state.queueIndex + 1);
            nextQueue.splice(insertAt, 0, trackId);
            set({ queueTrackIds: nextQueue, queueIndex: insertAt });
          }
          recordHistory(trackId, context, contextId);
          startPlaybackAt(trackId, startMs);
        },

        playCollection: (trackIds, startIndex = 0, context = 'playlist', contextId) => {
          const valid = trackIds.filter((id) => Boolean(getTrack(id)));
          if (valid.length === 0) {
            set({
              audioStatus: 'error',
              isPlaying: false,
              audioError: 'No playable tracks found in this collection.',
            });
            return;
          }
          const safeIndex = Math.max(0, Math.min(valid.length - 1, startIndex));
          const targetId = valid[safeIndex];
          set({
            queueTrackIds: valid,
            queueIndex: safeIndex,
          });
          recordHistory(targetId, context, contextId);
          startPlaybackAt(targetId, 0);
        },

        togglePlayPause: () => {
          const state = get();
          const firstTrack = useCatalogStore.getState().tracks[0]?.id;
          const activeId = state.currentTrackId ?? firstTrack;
          if (!activeId) return;
          if (state.isPlaying) {
            audioEngine.pause();
            set({ isPlaying: false, audioStatus: 'paused' });
          } else {
            const track = getTrack(activeId);
            if (!track) return;
            set({ audioError: null, audioStatus: 'loading' });
            void audioEngine.loadAndPlay(track, state.currentTimeMs);
          }
        },

        retryCurrentTrack: () => {
          const state = get();
          if (!state.currentTrackId) return;
          startPlaybackAt(state.currentTrackId, state.currentTimeMs, true);
        },

        clearAudioError: () => set({ audioError: null }),

        nextTrack: () => {
          const state = get();
          if (state.queueTrackIds.length === 0) return;

          let nextIdx: number;
          if (state.shuffle && state.queueTrackIds.length > 1) {
            do {
              nextIdx = Math.floor(Math.random() * state.queueTrackIds.length);
            } while (nextIdx === state.queueIndex);
          } else if (state.queueIndex + 1 < state.queueTrackIds.length) {
            nextIdx = state.queueIndex + 1;
          } else if (state.repeatMode === 'all') {
            nextIdx = 0;
          } else {
            audioEngine.pause();
            set({ isPlaying: false, audioStatus: 'paused', currentTimeMs: 0 });
            return;
          }

          const nextId = state.queueTrackIds[nextIdx];
          set({ queueIndex: nextIdx });
          recordHistory(nextId, 'direct');
          startPlaybackAt(nextId, 0);
        },

        prevTrack: () => {
          const state = get();
          if (state.currentTimeMs > 3000) {
            audioEngine.seek(0);
            set({ currentTimeMs: 0 });
            return;
          }
          if (state.queueTrackIds.length === 0) return;
          const prevIdx =
            state.queueIndex > 0
              ? state.queueIndex - 1
              : state.repeatMode === 'all'
                ? state.queueTrackIds.length - 1
                : 0;
          const prevId = state.queueTrackIds[prevIdx];
          set({ queueIndex: prevIdx });
          recordHistory(prevId, 'direct');
          startPlaybackAt(prevId, 0);
        },

        seek: (ms) => {
          const state = get();
          const clamped = Math.max(0, Math.min(state.durationMs, ms));
          audioEngine.seek(clamped);
          set({ currentTimeMs: clamped });
        },

        setVolume: (volume) => {
          const clamped = Math.max(0, Math.min(1, volume));
          const muted = clamped === 0;
          audioEngine.setVolume(clamped, muted);
          set({ volume: clamped, muted });
        },

        toggleMute: () => {
          const state = get();
          const nextMuted = !state.muted;
          audioEngine.setVolume(state.volume, nextMuted);
          set({ muted: nextMuted });
        },

        toggleShuffle: () => {
          set((s) => ({ shuffle: !s.shuffle }));
          syncQueueToServer();
        },

        cycleRepeat: () => {
          set((s) => ({
            repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
          }));
          syncQueueToServer();
        },

        addToQueue: (trackId) => {
          if (!getTrack(trackId)) return;
          set((s) => ({
            queueTrackIds: [...s.queueTrackIds, trackId],
          }));
          syncQueueToServer();
        },

        playNext: (trackId) => {
          if (!getTrack(trackId)) return;
          set((s) => {
            const next = [...s.queueTrackIds];
            next.splice(s.queueIndex + 1, 0, trackId);
            return { queueTrackIds: next };
          });
          syncQueueToServer();
        },

        removeFromQueue: (index) => {
          set((s) => {
            if (index === s.queueIndex) return s;
            const next = s.queueTrackIds.filter((_, idx) => idx !== index);
            const adjustedIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
            return {
              queueTrackIds: next,
              queueIndex: Math.max(0, adjustedIndex),
            };
          });
          syncQueueToServer();
        },

        moveQueueItem: (fromIndex, toIndex) => {
          set((s) => {
            if (
              fromIndex === s.queueIndex ||
              toIndex === s.queueIndex ||
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= s.queueTrackIds.length ||
              toIndex >= s.queueTrackIds.length
            ) {
              return s;
            }
            const next = [...s.queueTrackIds];
            const [item] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, item);

            let newQueueIndex = s.queueIndex;
            if (fromIndex < s.queueIndex && toIndex >= s.queueIndex) newQueueIndex -= 1;
            else if (fromIndex > s.queueIndex && toIndex <= s.queueIndex) newQueueIndex += 1;

            return { queueTrackIds: next, queueIndex: newQueueIndex };
          });
          syncQueueToServer();
        },

        clearUpcomingQueue: () => {
          set((s) => {
            if (!s.currentTrackId) return { queueTrackIds: [], queueIndex: 0 };
            return {
              queueTrackIds: [s.currentTrackId],
              queueIndex: 0,
            };
          });
          syncQueueToServer();
        },

        setQueueOpen: (open) => set({ isQueueOpen: open }),
        toggleQueueOpen: () => set((s) => ({ isQueueOpen: !s.isQueueOpen })),
        setMobileSheetOpen: (open) => set({ isMobileSheetOpen: open }),
      };
    },
    {
      name: 'soundsphere-player-v2',
      partialize: (state) => ({
        currentTrackId: state.currentTrackId,
        queueTrackIds: state.queueTrackIds,
        queueIndex: state.queueIndex,
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeatMode: state.repeatMode,
      }),
    }
  )
);
