import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { MediaCard } from '@/components/cards/MediaCard';
import { TrackRow } from '@/components/cards/TrackRow';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';

type SearchTab = 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [activeTab, setActiveTab] = useState<SearchTab>('all');

  const artistsList = useCatalogStore((s) => s.artists);
  const albumsList = useCatalogStore((s) => s.albums);
  const tracksList = useCatalogStore((s) => s.tracks);
  const editorialPlaylists = useCatalogStore((s) => s.editorialPlaylists);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getTracksByAlbum = useCatalogStore((s) => s.getTracksByAlbum);
  const getTracksByArtist = useCatalogStore((s) => s.getTracksByArtist);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const userPlaylists = useLibraryStore((s) => s.userPlaylists);

  const normalized = query.trim().toLowerCase();
  const allPlaylists = useMemo(
    () => [...userPlaylists, ...editorialPlaylists],
    [userPlaylists, editorialPlaylists]
  );

  const results = useMemo(() => {
    if (!normalized) {
      return {
        tracks: tracksList.slice(0, 8),
        albums: albumsList.slice(0, 4),
        artists: artistsList,
        playlists: allPlaylists,
      };
    }

    const tracks = tracksList.filter((t) => {
      const artist = getArtistById(t.artistId);
      return (
        t.title.toLowerCase().includes(normalized) ||
        t.genre.toLowerCase().includes(normalized) ||
        t.mood.toLowerCase().includes(normalized) ||
        (artist?.name.toLowerCase().includes(normalized) ?? false)
      );
    });

    const albums = albumsList.filter((a) => {
      const artist = getArtistById(a.artistId);
      return (
        a.title.toLowerCase().includes(normalized) ||
        a.genre.toLowerCase().includes(normalized) ||
        (artist?.name.toLowerCase().includes(normalized) ?? false)
      );
    });

    const artists = artistsList.filter(
      (ar) =>
        ar.name.toLowerCase().includes(normalized) ||
        ar.primaryGenre.toLowerCase().includes(normalized) ||
        ar.country.toLowerCase().includes(normalized)
    );

    const playlists = allPlaylists.filter(
      (pl) =>
        pl.title.toLowerCase().includes(normalized) ||
        pl.description.toLowerCase().includes(normalized)
    );

    return { tracks, albums, artists, playlists };
  }, [normalized, allPlaylists, tracksList, albumsList, artistsList, getArtistById]);

  const totalMatches =
    results.tracks.length +
    results.albums.length +
    results.artists.length +
    results.playlists.length;

  const tabs: { id: SearchTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: totalMatches },
    { id: 'tracks', label: 'Songs', count: results.tracks.length },
    { id: 'albums', label: 'Albums', count: results.albums.length },
    { id: 'artists', label: 'Artists', count: results.artists.length },
    { id: 'playlists', label: 'Playlists', count: results.playlists.length },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 border-b border-[#1F242D] pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              {normalized ? `Results for "${query}"` : 'Search Catalog'}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {normalized
                ? `${totalMatches} matching items across songs, albums, artists, and playlists.`
                : 'Search across songs, albums, artists, genres, and playlists.'}
            </p>
          </div>
        </div>

        {/* Inline search input for mobile convenience */}
        <div className="relative max-w-md sm:hidden">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) =>
              setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
            }
            placeholder="Filter catalog..."
            className="h-9 w-full rounded-md border border-[#1F242D] bg-[#14171D] pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                  : 'border-[#1F242D] bg-[#14171D] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {totalMatches === 0 ? (
        <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-10 text-center">
          <p className="text-sm font-medium text-zinc-200">No matching results found</p>
          <p className="mt-1 text-xs text-zinc-400">
            Try searching for another artist, album title, or genre such as Ambient, Minimal, or Lo-Fi.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(activeTab === 'all' || activeTab === 'tracks') && results.tracks.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-100">Songs</h2>
              <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
                {results.tracks.map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    onPlay={() =>
                      playCollection(
                        results.tracks.map((t) => t.id),
                        idx,
                        'search'
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'albums') && results.albums.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-100">Albums</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {results.albums.map((album) => {
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
                        isAlbumPlaying
                          ? togglePlayPause()
                          : playCollection(ids, 0, 'album', album.id)
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'artists') && results.artists.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-100">Artists</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {results.artists.map((artist) => {
                  const ids = getTracksByArtist(artist.id).map((t) => t.id);
                  const isArtistPlaying = Boolean(
                    isPlaying && currentTrackId && ids.includes(currentTrackId)
                  );
                  return (
                    <MediaCard
                      key={artist.id}
                      title={artist.name}
                      subtitle={artist.primaryGenre}
                      artworkUrl={artist.artworkUrl}
                      to={`/artist/${artist.id}`}
                      isPlaying={isArtistPlaying}
                      onPlayClick={() =>
                        isArtistPlaying
                          ? togglePlayPause()
                          : playCollection(ids, 0, 'direct', artist.id)
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'playlists') && results.playlists.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-100">Playlists</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {results.playlists.map((pl) => {
                  const isPlPlaying = Boolean(
                    isPlaying && currentTrackId && pl.trackIds.includes(currentTrackId)
                  );
                  return (
                    <MediaCard
                      key={pl.id}
                      title={pl.title}
                      subtitle={`${pl.trackIds.length} tracks | ${pl.ownerName}`}
                      artworkUrl={pl.coverUrl}
                      to={`/playlist/${pl.id}`}
                      isPlaying={isPlPlaying}
                      onPlayClick={() =>
                        isPlPlaying
                          ? togglePlayPause()
                          : playCollection(pl.trackIds, 0, 'playlist', pl.id)
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

