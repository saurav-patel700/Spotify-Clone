import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertCircle, Loader2, RotateCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { BottomPlayer } from '../player/BottomPlayer';
import { QueueDrawer } from '../player/QueueDrawer';
import { AppModals } from '../modals/AppModals';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useFocusStore } from '@/stores/useFocusStore';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { useUiStore } from '@/stores/useUiStore';

export function AppShell() {
  const initEngine = usePlayerStore((s) => s.initEngine);
  const hydrateHistory = usePlayerStore((s) => s.hydrateHistory);
  const clearUserHistory = usePlayerStore((s) => s.clearUserHistory);

  const hydrateLibrary = useLibraryStore((s) => s.hydrateFromServer);
  const clearLibrary = useLibraryStore((s) => s.clearLibrary);

  const hydrateFocusSessions = useFocusStore((s) => s.hydrateSessions);
  const clearFocusSessions = useFocusStore((s) => s.clearSessions);

  const hydrateMemory = useMemoryStore((s) => s.hydrateMemory);
  const clearMemory = useMemoryStore((s) => s.clearMemory);

  const hydrateSession = useAuthStore((s) => s.hydrateSession);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const hydrateCatalog = useCatalogStore((s) => s.hydrateCatalog);
  const catalogLoading = useCatalogStore((s) => s.isLoading);
  const catalogHasLoaded = useCatalogStore((s) => s.hasLoaded);
  const catalogError = useCatalogStore((s) => s.error);

  const focusRunning = useFocusStore((s) => s.isRunning);
  const focusTick = useFocusStore((s) => s.tick);
  const adaptiveTrackCount = useFocusStore((s) => s.adaptiveTrackIds.length);
  const regenerateAdaptiveQueue = useFocusStore((s) => s.regenerateAdaptiveQueue);

  const isMobileSidebarOpen = useUiStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const toastMessage = useUiStore((s) => s.toastMessage);

  useEffect(() => {
    initEngine();
    void hydrateCatalog();
    void hydrateSession();
  }, [initEngine, hydrateCatalog, hydrateSession]);

  useEffect(() => {
    if (catalogHasLoaded && adaptiveTrackCount === 0) {
      regenerateAdaptiveQueue();
    }
  }, [catalogHasLoaded, adaptiveTrackCount, regenerateAdaptiveQueue]);

  useEffect(() => {
    if (userId && accessToken) {
      void hydrateLibrary();
      void hydrateHistory();
      void hydrateFocusSessions();
      void hydrateMemory(userId);
    } else {
      clearLibrary();
      clearUserHistory();
      clearFocusSessions();
      clearMemory();
    }
  }, [
    userId,
    accessToken,
    hydrateLibrary,
    hydrateHistory,
    hydrateFocusSessions,
    hydrateMemory,
    clearLibrary,
    clearUserHistory,
    clearFocusSessions,
    clearMemory,
  ]);

  useEffect(() => {
    if (!focusRunning) return;

    focusTick();
    const interval = setInterval(() => {
      focusTick();
    }, 500);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        focusTick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [focusRunning, focusTick]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0A0B0D] text-zinc-100">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          mobileOpen={isMobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {catalogError && !catalogHasLoaded ? (
              <div className="mx-auto max-w-lg rounded-lg border border-red-500/40 bg-[#14171D] p-6 text-center space-y-3">
                <AlertCircle className="mx-auto h-6 w-6 text-red-400" />
                <p className="text-sm font-medium text-zinc-100">Unable to connect to SoundSphere API</p>
                <p className="text-xs text-zinc-400">{catalogError}</p>
                <button
                  type="button"
                  onClick={() => void hydrateCatalog()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-zinc-950"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry Connection
                </button>
              </div>
            ) : catalogLoading && !catalogHasLoaded ? (
              <div className="flex h-64 items-center justify-center">
                <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Loading catalog from database...
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>

        <QueueDrawer />
      </div>

      <BottomPlayer />
      <MobileNav />
      <AppModals />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-24 right-4 z-50 rounded-md border border-emerald-500/40 bg-[#14171D] px-3.5 py-2 text-xs font-medium text-zinc-100 shadow-lg md:bottom-24 md:right-6"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
