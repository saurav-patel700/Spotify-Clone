import { useParams, Link } from 'react-router-dom';
import { Play, Pause, MapPin } from 'lucide-react';
import { MediaCard } from '@/components/cards/MediaCard';
import { TrackRow } from '@/components/cards/TrackRow';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const artists = useCatalogStore((s) => s.artists);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getTracksByArtist = useCatalogStore((s) => s.getTracksByArtist);
  const getAlbumsByArtist = useCatalogStore((s) => s.getAlbumsByArtist);
  const getTracksByAlbum = useCatalogStore((s) => s.getTracksByAlbum);

  const artist = id ? getArtistById(id) : undefined;
  const tracks = artist ? getTracksByArtist(artist.id) : [];
  const albums = artist ? getAlbumsByArtist(artist.id) : [];

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  if (!artist) {
    return (
      <div className="mx-auto max-w-4xl rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Artist not found</h1>
        <Link to="/" className="mt-3 inline-block text-xs font-medium text-emerald-400">
          Return to Home
        </Link>
      </div>
    );
  }

  const trackIds = tracks.map((t) => t.id);
  const isArtistPlaying = Boolean(
    isPlaying && currentTrackId && trackIds.includes(currentTrackId)
  );
  const relatedArtists = artists.filter((a) => a.id !== artist.id).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-8">
      {/* Artist Header */}
      <div className="flex flex-col gap-6 rounded-lg border border-[#1F242D] bg-[#14171D] p-6 sm:flex-row sm:items-end">
        <img
          src={artist.artworkUrl}
          alt={artist.name}
          className="h-40 w-40 shrink-0 rounded-md border border-[#262B36] object-cover"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded border border-[#262B36] bg-[#0E1014] px-2 py-0.5 font-medium text-emerald-400">
              {artist.primaryGenre}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              {artist.country}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            {artist.name}
          </h1>

          <p className="max-w-2xl text-sm text-zinc-400 leading-relaxed">{artist.bio}</p>

          <div className="pt-1">
            <button
              type="button"
              onClick={() =>
                isArtistPlaying ? togglePlayPause() : playCollection(trackIds, 0, 'direct', artist.id)
              }
              className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              {isArtistPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" />
                  Pause Artist
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Play Tracks ({tracks.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Popular Tracks */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Catalog Tracks</h2>
        <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              onPlay={() => playCollection(trackIds, idx, 'direct', artist.id)}
            />
          ))}
        </div>
      </section>

      {/* Discography */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Discography</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((album) => {
            const albumIds = getTracksByAlbum(album.id).map((t) => t.id);
            const isAlbumPlaying = Boolean(
              isPlaying && currentTrackId && albumIds.includes(currentTrackId)
            );
            return (
              <MediaCard
                key={album.id}
                title={album.title}
                subtitle={`${album.releaseDate.slice(0, 4)} | ${album.genre}`}
                artworkUrl={album.coverUrl}
                to={`/album/${album.id}`}
                badge={album.albumType}
                isPlaying={isAlbumPlaying}
                onPlayClick={() =>
                  isAlbumPlaying
                    ? togglePlayPause()
                    : playCollection(albumIds, 0, 'album', album.id)
                }
              />
            );
          })}
        </div>
      </section>

      {/* Related Artists */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Related Artists</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {relatedArtists.map((rel) => (
            <MediaCard
              key={rel.id}
              title={rel.name}
              subtitle={`${rel.primaryGenre} | ${rel.country}`}
              artworkUrl={rel.artworkUrl}
              to={`/artist/${rel.id}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

