import { create } from 'zustand';

interface UiState {
  isMobileSidebarOpen: boolean;
  isCreatePlaylistOpen: boolean;
  createPlaylistInitialTrackId: string | null;
  quickPinTrackId: string | null;
  quickPinTimestampMs: number;
  toastMessage: string | null;

  setMobileSidebarOpen: (open: boolean) => void;
  openCreatePlaylist: (initialTrackId?: string | null) => void;
  closeCreatePlaylist: () => void;
  openQuickPin: (trackId: string, timestampMs: number) => void;
  closeQuickPin: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>((set) => ({
  isMobileSidebarOpen: false,
  isCreatePlaylistOpen: false,
  createPlaylistInitialTrackId: null,
  quickPinTrackId: null,
  quickPinTimestampMs: 0,
  toastMessage: null,

  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),

  openCreatePlaylist: (initialTrackId = null) =>
    set({
      isCreatePlaylistOpen: true,
      createPlaylistInitialTrackId: initialTrackId,
    }),

  closeCreatePlaylist: () =>
    set({
      isCreatePlaylistOpen: false,
      createPlaylistInitialTrackId: null,
    }),

  openQuickPin: (trackId, timestampMs) =>
    set({
      quickPinTrackId: trackId,
      quickPinTimestampMs: timestampMs,
    }),

  closeQuickPin: () =>
    set({
      quickPinTrackId: null,
      quickPinTimestampMs: 0,
    }),

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: message });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 2800);
  },

  clearToast: () => set({ toastMessage: null }),
}));

