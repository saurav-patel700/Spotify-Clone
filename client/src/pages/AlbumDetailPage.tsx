import { useParams, Link } from 'react-router-dom';
import { Play, Pause, Heart, ListPlus, ShieldCheck } from 'lucide-react';
import { TrackRow } from '@/components/cards/TrackRow';
import { formatRelativeDate, formatTotalMinutes } from '@/lib/formatters';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useUiStore } from '@/stores/useUiStore';

export function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getTracksByAlbum = useCatalogStore((s) => s.getTracksByAlbum);

  const album = id ? getAlbumById(id) : undefined;
  const artist = album ? getArtistById(album.artistId) : undefined;
  const tracks = album ? getTracksByAlbum(album.id) : [];

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const savedAlbumIds = useLibraryStore((s) => s.savedAlbumIds);
  const toggleSavedAlbum = useLibraryStore((s) => s.toggleSavedAlbum);
  const showToast = useUiStore((s) => s.showToast);

  if (!album) {
    return (
      <div className="mx-auto max-w-4xl rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Album not found</h1>
        <Link to="/" className="mt-3 inline-block text-xs font-medium text-emerald-400">
          Return to Home
        </Link>
      </div>
    );
  }

  const trackIds = tracks.map((t) => t.id);
  const totalMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const isAlbumPlaying = Boolean(
    isPlaying && currentTrackId && trackIds.includes(currentTrackId)
  );
  const isSaved = savedAlbumIds.includes(album.id);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-lg border border-[#1F242D] bg-[#14171D] p-6 sm:flex-row sm:items-end">
        <img
          src={album.coverUrl}
          alt={album.title}
          className="h-44 w-44 shrink-0 rounded-md border border-[#262B36] object-cover"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded border border-[#262B36] bg-[#0E1014] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-300">
              {album.albumType}
            </span>
            <span className="text-xs text-zinc-400">{album.genre}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            {album.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {artist && (
              <Link
                to={`/artist/${artist.id}`}
                className="font-semibold text-zinc-200 hover:text-emerald-400"
              >
                {artist.name}
              </Link>
            )}
            <span>|</span>
            <span>{formatRelativeDate(album.releaseDate)}</span>
            <span>|</span>
            <span>{tracks.length} tracks</span>
            <span>|</span>
            <span>{formatTotalMinutes(totalMs)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() =>
                isAlbumPlaying ? togglePlayPause() : playCollection(trackIds, 0, 'album', album.id)
              }
              className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              {isAlbumPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Play Album
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                toggleSavedAlbum(album.id);
                showToast(isSaved ? `Removed "${album.title}" from library` : `Saved "${album.title}" to library`);
              }}
              className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-medium transition-colors ${
                isSaved
                  ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                  : 'border-[#262B36] bg-[#0E1014] text-zinc-300 hover:border-[#2E3542]'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Saved' : 'Save Album'}
            </button>

            <button
              type="button"
              onClick={() => {
                trackIds.forEach((tid) => addToQueue(tid));
                showToast(`Queued ${trackIds.length} tracks from "${album.title}"`);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-[#262B36] bg-[#0E1014] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:border-[#2E3542]"
            >
              <ListPlus className="h-3.5 w-3.5" />
              Add to Queue
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
        {tracks.map((track, idx) => (
          <TrackRow
            key={track.id}
            track={track}
            index={idx}
            showAlbum={false}
            onPlay={() => playCollection(trackIds, idx, 'album', album.id)}
          />
        ))}
      </div>

      {/* Licensing Attribution */}
      {tracks[0] && (
        <div className="flex items-center gap-2 rounded-md border border-[#1F242D] bg-[#14171D] px-4 py-3 text-xs text-zinc-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            Audio License: <strong className="text-zinc-200">{tracks[0].licenseType}</strong> |{' '}
            {tracks[0].attributionText}
          </span>
        </div>
      )}
    </div>
  );
}

