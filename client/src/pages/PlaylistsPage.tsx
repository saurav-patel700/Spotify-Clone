import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { MediaCard } from '@/components/cards/MediaCard';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUiStore } from '@/stores/useUiStore';
import { formatTotalMinutes } from '@/lib/formatters';

export function PlaylistsPage() {
  const editorialPlaylists = useCatalogStore((s) => s.editorialPlaylists);
  const getTrackById = useCatalogStore((s) => s.getTrackById);

  const userPlaylists = useLibraryStore((s) => s.userPlaylists);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const syncError = useLibraryStore((s) => s.syncError);
  const clearSyncError = useLibraryStore((s) => s.clearSyncError);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const openCreatePlaylist = useUiStore((s) => s.openCreatePlaylist);

  const renderCard = (pl: (typeof userPlaylists)[number]) => {
    const totalMs = pl.trackIds.reduce(
      (acc, id) => acc + (getTrackById(id)?.durationMs ?? 0),
      0
    );
    const isPlPlaying = Boolean(
      isPlaying && currentTrackId && pl.trackIds.includes(currentTrackId)
    );
    return (
      <MediaCard
        key={pl.id}
        title={pl.title}
        subtitle={`${pl.trackIds.length} tracks | ${formatTotalMinutes(totalMs)}`}
        artworkUrl={pl.coverUrl}
        to={`/playlist/${pl.id}`}
        isPlaying={isPlPlaying}
        onPlayClick={() =>
          isPlPlaying ? togglePlayPause() : playCollection(pl.trackIds, 0, 'playlist', pl.id)
        }
      />
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-8">
      <div className="flex flex-col gap-4 border-b border-[#1F242D] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Playlists</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage personal sequences and curated collections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreatePlaylist()}
          className="inline-flex items-center gap-2 self-start rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Playlist
        </button>
      </div>

      {syncError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-md border border-red-500/40 bg-red-950/30 px-3.5 py-2 text-xs text-red-200"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            {syncError}
          </span>
          <button type="button" onClick={clearSyncError} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">
            Your Playlists ({userPlaylists.length})
          </h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />}
        </div>

        {userPlaylists.length === 0 ? (
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center text-sm text-zinc-400">
            No personal playlists created yet. Click Create Playlist to start a collection.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {userPlaylists.map(renderCard)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          SoundSphere Curated ({editorialPlaylists.length})
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {editorialPlaylists.map(renderCard)}
        </div>
      </section>
    </div>
  );
}
