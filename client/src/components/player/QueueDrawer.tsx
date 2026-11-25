import { X, Play, ArrowUp, ArrowDown, Trash2, ListMusic } from 'lucide-react';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { formatDuration } from '@/lib/formatters';
import { usePlayerStore } from '@/stores/usePlayerStore';

export function QueueDrawer() {
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const queueTrackIds = usePlayerStore((s) => s.queueTrackIds);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveQueueItem = usePlayerStore((s) => s.moveQueueItem);
  const clearUpcomingQueue = usePlayerStore((s) => s.clearUpcomingQueue);

  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);

  if (!isQueueOpen) return null;

  const currentTrack = currentTrackId ? getTrackById(currentTrackId) : undefined;
  const currentArtist = currentTrack ? getArtistById(currentTrack.artistId) : undefined;
  const currentAlbum = currentTrack ? getAlbumById(currentTrack.albumId) : undefined;

  const upcomingEntries = queueTrackIds
    .map((id, idx) => ({ id, idx, track: getTrackById(id) }))
    .filter((item) => item.idx > queueIndex && item.track !== undefined);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-[#1F242D] bg-[#0E1014] pb-24 lg:static lg:z-auto lg:w-80 lg:pb-0">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#1F242D] px-4">
        <div className="flex items-center gap-2">
          <ListMusic className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Playback Queue</h2>
        </div>
        <button
          type="button"
          onClick={() => setQueueOpen(false)}
          aria-label="Close queue"
          className="rounded-md p-1.5 text-zinc-400 hover:bg-[#1B1F27] hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {currentTrack && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Now Playing
            </div>
            <div className="flex items-center gap-3 rounded-md border border-emerald-500/35 bg-[#14171D] p-2.5">
              {currentAlbum && (
                <img
                  src={currentAlbum.coverUrl}
                  alt={currentAlbum.title}
                  className="h-11 w-11 shrink-0 rounded border border-[#262B36] object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-emerald-400">{currentTrack.title}</p>
                <p className="truncate text-xs text-zinc-400">{currentArtist?.name}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                {formatDuration(currentTrack.durationMs)}
              </span>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Up Next ({upcomingEntries.length})
            </span>
            {upcomingEntries.length > 0 && (
              <button
                type="button"
                onClick={clearUpcomingQueue}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>

          {upcomingEntries.length === 0 ? (
            <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-4 text-center text-xs text-zinc-500">
              No upcoming tracks in queue. Add tracks from any album or playlist.
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcomingEntries.map(({ id, idx, track }) => {
                if (!track) return null;
                const artist = getArtistById(track.artistId);
                const album = getAlbumById(track.albumId);
                return (
                  <div
                    key={`${id}-${idx}`}
                    className="group flex items-center gap-2.5 rounded-md border border-[#1F242D] bg-[#14171D] p-2 hover:border-[#2E3542]"
                  >
                    <button
                      type="button"
                      onClick={() => playCollection(queueTrackIds, idx, 'direct')}
                      aria-label={`Play ${track.title}`}
                      className="relative h-9 w-9 shrink-0 overflow-hidden rounded border border-[#262B36]"
                    >
                      {album && (
                        <img
                          src={album.coverUrl}
                          alt={album.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100">
                        <Play className="h-3.5 w-3.5 fill-current text-zinc-100" />
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-100">{track.title}</p>
                      <p className="truncate text-[11px] text-zinc-400">{artist?.name}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      {idx > queueIndex + 1 && (
                        <button
                          type="button"
                          onClick={() => moveQueueItem(idx, idx - 1)}
                          aria-label="Move up in queue"
                          className="rounded p-1 text-zinc-500 hover:bg-[#1E242E] hover:text-zinc-200"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {idx < queueTrackIds.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveQueueItem(idx, idx + 1)}
                          aria-label="Move down in queue"
                          className="rounded p-1 text-zinc-500 hover:bg-[#1E242E] hover:text-zinc-200"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFromQueue(idx)}
                        aria-label="Remove from queue"
                        className="rounded p-1 text-zinc-500 hover:bg-red-950/50 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

