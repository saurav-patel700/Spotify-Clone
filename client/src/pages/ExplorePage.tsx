import { useState, useMemo } from 'react';
import { SlidersHorizontal, Play } from 'lucide-react';
import { MediaCard } from '@/components/cards/MediaCard';
import { TrackRow } from '@/components/cards/TrackRow';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

const GENRES = ['All', 'Ambient', 'Minimal', 'Electronic', 'Lo-Fi', 'Acoustic'] as const;

export function ExplorePage() {
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [instrumentalOnly, setInstrumentalOnly] = useState(false);
  const [maxBpm, setMaxBpm] = useState<number>(130);

  const albums = useCatalogStore((s) => s.albums);
  const tracks = useCatalogStore((s) => s.tracks);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getTracksByAlbum = useCatalogStore((s) => s.getTracksByAlbum);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (selectedGenre !== 'All' && t.genre !== selectedGenre) return false;
      if (instrumentalOnly && !t.isInstrumental) return false;
      if (t.bpm > maxBpm) return false;
      return true;
    });
  }, [tracks, selectedGenre, instrumentalOnly, maxBpm]);

  const filteredAlbums = useMemo(() => {
    if (selectedGenre === 'All') return albums;
    return albums.filter((a) => a.genre === selectedGenre);
  }, [albums, selectedGenre]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-8">
      <div className="flex flex-col gap-4 border-b border-[#1F242D] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Explore Catalog</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Filter recordings by genre, tempo, and instrumentation.
          </p>
        </div>

        {filteredTracks.length > 0 && (
          <button
            type="button"
            onClick={() =>
              playCollection(
                filteredTracks.map((t) => t.id),
                0,
                'direct'
              )
            }
            className="inline-flex items-center gap-2 self-start rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Play Filtered ({filteredTracks.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-md border border-[#1F242D] bg-[#14171D] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {GENRES.map((genre) => {
            const active = selectedGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(genre)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                    : 'border-[#262B36] bg-[#0E1014] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={instrumentalOnly}
              onChange={(e) => setInstrumentalOnly(e.target.checked)}
              className="h-4 w-4 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
            />
            Instrumental only
          </label>

          <div className="flex items-center gap-2.5 text-xs text-zinc-300">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
            <span className="tabular-nums">Max {maxBpm} BPM</span>
            <input
              type="range"
              min={70}
              max={130}
              step={2}
              value={maxBpm}
              onChange={(e) => setMaxBpm(Number(e.target.value))}
              className="ss-range w-24"
              style={{
                background: `linear-gradient(to right, #10B981 ${((maxBpm - 70) / 60) * 100}%, #262B36 ${((maxBpm - 70) / 60) * 100}%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Matching Albums */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-zinc-100">
          Releases ({filteredAlbums.length})
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredAlbums.map((album) => {
            const artist = getArtistById(album.artistId);
            const ids = getTracksByAlbum(album.id).map((t) => t.id);
            const isAlbumPlaying = Boolean(
              isPlaying && currentTrackId && ids.includes(currentTrackId)
            );
            return (
              <MediaCard
                key={album.id}
                title={album.title}
                subtitle={`${artist?.name ?? 'Artist'} | ${album.genre}`}
                artworkUrl={album.coverUrl}
                to={`/album/${album.id}`}
                badge={album.albumType}
                isPlaying={isAlbumPlaying}
                onPlayClick={() =>
                  isAlbumPlaying ? togglePlayPause() : playCollection(ids, 0, 'album', album.id)
                }
              />
            );
          })}
        </div>
      </section>

      {/* Matching Tracks */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-100">
          Tracks ({filteredTracks.length})
        </h2>
        {filteredTracks.length === 0 ? (
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center text-sm text-zinc-400">
            No tracks match the current tempo or instrumentation filter.
          </div>
        ) : (
          <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
            {filteredTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                onPlay={() =>
                  playCollection(
                    filteredTracks.map((t) => t.id),
                    idx,
                    'direct'
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

