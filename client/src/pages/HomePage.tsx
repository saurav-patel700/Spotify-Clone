import { Link } from 'react-router-dom';
import { Play, Pause, Clock, ArrowRight } from 'lucide-react';
import { MediaCard } from '@/components/cards/MediaCard';
import { TrackRow } from '@/components/cards/TrackRow';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { formatDuration, formatTotalMinutes } from '@/lib/formatters';

export function HomePage() {
  const artists = useCatalogStore((s) => s.artists);
  const albums = useCatalogStore((s) => s.albums);
  const tracks = useCatalogStore((s) => s.tracks);
  const editorialPlaylists = useCatalogStore((s) => s.editorialPlaylists);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);
  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getTracksByAlbum = useCatalogStore((s) => s.getTracksByAlbum);
  const getTracksByArtist = useCatalogStore((s) => s.getTracksByArtist);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  const featuredAlbums = albums.filter((a) => a.featured);
  const newReleases = albums.filter((a) => a.isNewRelease);
  const trendingTracks = tracks
    .filter((t) => t.trendingRank !== undefined)
    .sort((a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99));

  const recentTracks = recentlyPlayed
    .slice(0, 5)
    .map((item) => getTrackById(item.trackId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const handlePlayAlbum = (albumId: string) => {
    const albumTracks = getTracksByAlbum(albumId);
    const ids = albumTracks.map((t) => t.id);
    if (ids.length === 0) return;
    if (currentTrackId && ids.includes(currentTrackId)) {
      togglePlayPause();
    } else {
      playCollection(ids, 0, 'album', albumId);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-8">
      {/* Featured Albums */}
      <section aria-labelledby="featured-albums-heading">
        <div className="mb-4 flex items-center justify-between">
          <h1 id="featured-albums-heading" className="text-xl font-semibold tracking-tight text-zinc-100">
            Featured Albums
          </h1>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            Browse catalog
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featuredAlbums.map((album) => {
            const artist = getArtistById(album.artistId);
            const albumTrackIds = getTracksByAlbum(album.id).map((t) => t.id);
            const isAlbumPlaying = Boolean(
              isPlaying && currentTrackId && albumTrackIds.includes(currentTrackId)
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
                onPlayClick={() => handlePlayAlbum(album.id)}
              />
            );
          })}
        </div>
      </section>

      {/* Recently Played */}
      {recentTracks.length > 0 && (
        <section aria-labelledby="recently-played-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recently-played-heading" className="text-lg font-semibold tracking-tight text-zinc-100">
              Recently Played
            </h2>
            <Link
              to="/library"
              className="text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              View history
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {recentTracks.map((track) => {
              const artist = getArtistById(track.artistId);
              const album = getAlbumById(track.albumId);
              const isCurrent = currentTrackId === track.id;
              return (
                <div
                  key={track.id}
                  className={`group flex items-center gap-3 rounded-md border p-2.5 transition-colors ${
                    isCurrent
                      ? 'border-emerald-500/40 bg-[#161D1A]'
                      : 'border-[#1F242D] bg-[#14171D] hover:border-[#2E3542] hover:bg-[#191D25]'
                  }`}
                >
                  {album && (
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="h-11 w-11 shrink-0 rounded border border-[#262B36] object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => (isCurrent ? togglePlayPause() : playTrack(track.id, 'direct'))}
                      className={`block w-full truncate text-left text-xs font-medium ${
                        isCurrent ? 'text-emerald-400' : 'text-zinc-100 hover:text-emerald-400'
                      }`}
                    >
                      {track.title}
                    </button>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                      {artist?.name} | {formatDuration(track.durationMs)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (isCurrent ? togglePlayPause() : playTrack(track.id, 'direct'))}
                    aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isCurrent && isPlaying
                        ? 'border-emerald-400/50 bg-emerald-500 text-zinc-950'
                        : 'border-[#262B36] bg-[#0E1014] text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-400'
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trending Music */}
      <section aria-labelledby="trending-music-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="trending-music-heading" className="text-lg font-semibold tracking-tight text-zinc-100">
            Trending Music
          </h2>
          <div className="hidden md:flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" />
            <span>Duration</span>
          </div>
        </div>

        <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
          {trendingTracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              onPlay={() =>
                playCollection(
                  trendingTracks.map((t) => t.id),
                  idx,
                  'direct'
                )
              }
            />
          ))}
        </div>
      </section>

      {/* Recommended Playlists */}
      <section aria-labelledby="recommended-playlists-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recommended-playlists-heading" className="text-lg font-semibold tracking-tight text-zinc-100">
            Recommended Playlists
          </h2>
          <Link
            to="/playlists"
            className="text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            All playlists
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {editorialPlaylists.map((pl) => {
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
                onPlayClick={() => {
                  if (isPlPlaying) {
                    togglePlayPause();
                  } else {
                    playCollection(pl.trackIds, 0, 'playlist', pl.id);
                  }
                }}
              />
            );
          })}
        </div>
      </section>

      {/* New Releases */}
      <section aria-labelledby="new-releases-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-releases-heading" className="text-lg font-semibold tracking-tight text-zinc-100">
            New Releases
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {newReleases.map((album) => {
            const artist = getArtistById(album.artistId);
            const ids = getTracksByAlbum(album.id).map((t) => t.id);
            const isAlbumPlaying = Boolean(
              isPlaying && currentTrackId && ids.includes(currentTrackId)
            );
            return (
              <MediaCard
                key={album.id}
                title={album.title}
                subtitle={`${artist?.name ?? 'Artist'} | ${album.releaseDate.slice(0, 4)}`}
                artworkUrl={album.coverUrl}
                to={`/album/${album.id}`}
                badge={album.albumType}
                isPlaying={isAlbumPlaying}
                onPlayClick={() => handlePlayAlbum(album.id)}
              />
            );
          })}
        </div>
      </section>

      {/* Artist Recommendations */}
      <section aria-labelledby="artist-recommendations-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="artist-recommendations-heading" className="text-lg font-semibold tracking-tight text-zinc-100">
            Artist Recommendations
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {artists.map((artist) => {
            const artistTracks = getTracksByArtist(artist.id).map((t) => t.id);
            const isArtistPlaying = Boolean(
              isPlaying && currentTrackId && artistTracks.includes(currentTrackId)
            );
            return (
              <MediaCard
                key={artist.id}
                title={artist.name}
                subtitle={`${artist.primaryGenre} | ${artist.country}`}
                artworkUrl={artist.artworkUrl}
                to={`/artist/${artist.id}`}
                isPlaying={isArtistPlaying}
                onPlayClick={() => {
                  if (isArtistPlaying) {
                    togglePlayPause();
                  } else {
                    playCollection(artistTracks, 0, 'direct', artist.id);
                  }
                }}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
