import { useState } from 'react';
import { Plus, Heart, Disc, History, ListMusic, Loader2, AlertCircle } from 'lucide-react';
import { MediaCard } from '@/components/cards/MediaCard';
import { TrackRow } from '@/components/cards/TrackRow';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUiStore } from '@/stores/useUiStore';

type LibraryTab = 'favorites' | 'playlists' | 'albums' | 'history';

export function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>('favorites');

  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getTracksByAlbum = useCatalogStore((s) => s.getTracksByAlbum);

  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);
  const savedAlbumIds = useLibraryStore((s) => s.savedAlbumIds);
  const userPlaylists = useLibraryStore((s) => s.userPlaylists);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const syncError = useLibraryStore((s) => s.syncError);
  const clearSyncError = useLibraryStore((s) => s.clearSyncError);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  const openCreatePlaylist = useUiStore((s) => s.openCreatePlaylist);

  const favoriteTracks = favoriteTrackIds
    .map((id) => getTrackById(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const savedAlbums = savedAlbumIds
    .map((id) => getAlbumById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const historyTracks = recentlyPlayed
    .map((entry) => getTrackById(entry.trackId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const tabs: { id: LibraryTab; label: string; count: number; icon: typeof Heart }[] = [
    { id: 'favorites', label: 'Favorites', count: favoriteTracks.length, icon: Heart },
    { id: 'playlists', label: 'Playlists', count: userPlaylists.length, icon: ListMusic },
    { id: 'albums', label: 'Saved Albums', count: savedAlbums.length, icon: Disc },
    { id: 'history', label: 'Recently Played', count: historyTracks.length, icon: History },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 border-b border-[#1F242D] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Your Library</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Saved tracks, personal playlists, albums, and recent playback history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreatePlaylist()}
          className="inline-flex items-center gap-2 self-start rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Playlist
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

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                  : 'border-[#1F242D] bg-[#14171D] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              <span className="tabular-nums text-zinc-500">({item.count})</span>
            </button>
          );
        })}
        {isLoading && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            Syncing library
          </span>
        )}
      </div>

      {tab === 'favorites' && (
        <div>
          {favoriteTracks.length === 0 ? (
            <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center text-sm text-zinc-400">
              No favorite tracks saved yet. Click the heart icon on any track to save it here.
            </div>
          ) : (
            <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
              {favoriteTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  onPlay={() =>
                    playCollection(
                      favoriteTracks.map((t) => t.id),
                      idx,
                      'direct'
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'playlists' && (
        <div>
          {userPlaylists.length === 0 ? (
            <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center text-sm text-zinc-400">
              You have no playlists yet. Click New Playlist to create one.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {userPlaylists.map((pl) => {
                const isPlPlaying = Boolean(
                  isPlaying && currentTrackId && pl.trackIds.includes(currentTrackId)
                );
                return (
                  <MediaCard
                    key={pl.id}
                    title={pl.title}
                    subtitle={`${pl.trackIds.length} tracks`}
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
          )}
        </div>
      )}

      {tab === 'albums' && (
        <div>
          {savedAlbums.length === 0 ? (
            <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center text-sm text-zinc-400">
              No albums saved yet. Open any album and click Save to keep it in your library.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {savedAlbums.map((album) => {
                const artist = getArtistById(album.artistId);
                const ids = getTracksByAlbum(album.id).map((t) => t.id);
                const isAlbumPlaying = Boolean(
                  isPlaying && currentTrackId && ids.includes(currentTrackId)
                );
                return (
                  <MediaCard
                    key={album.id}
                    title={album.title}
                    subtitle={artist?.name ?? 'Artist'}
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
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {historyTracks.length === 0 ? (
            <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center text-sm text-zinc-400">
              No playback history yet. Start listening to any track to see your history here.
            </div>
          ) : (
            <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
              {historyTracks.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  onPlay={() =>
                    playCollection(
                      historyTracks.map((t) => t.id),
                      idx,
                      'direct'
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
