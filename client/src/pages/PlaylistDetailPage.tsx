import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, Pause, Pencil, Trash2, Plus, Check, ListPlus } from 'lucide-react';
import { TrackRow } from '@/components/cards/TrackRow';
import { formatTotalMinutes } from '@/lib/formatters';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUiStore } from '@/stores/useUiStore';

export function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const allCatalogTracks = useCatalogStore((s) => s.tracks);
  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);

  const getPlaylistById = useLibraryStore((s) => s.getPlaylistById);
  const userPlaylists = useLibraryStore((s) => s.userPlaylists);
  const updatePlaylist = useLibraryStore((s) => s.updatePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);
  const moveTrackInPlaylist = useLibraryStore((s) => s.moveTrackInPlaylist);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playCollection = usePlayerStore((s) => s.playCollection);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const showToast = useUiStore((s) => s.showToast);

  const playlist = id ? getPlaylistById(id) : undefined;
  const isOwned = Boolean(playlist && userPlaylists.some((p) => p.id === playlist.id));

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!playlist) {
    return (
      <div className="mx-auto max-w-4xl rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Playlist not found</h1>
        <Link to="/playlists" className="mt-3 inline-block text-xs font-medium text-emerald-400">
          Browse Playlists
        </Link>
      </div>
    );
  }

  const tracks = playlist.trackIds
    .map((tid) => getTrackById(tid))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const totalMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const isPlPlaying = Boolean(
    isPlaying && currentTrackId && playlist.trackIds.includes(currentTrackId)
  );

  const availableToAdd = allCatalogTracks.filter((t) => !playlist.trackIds.includes(t.id));

  const startEditing = () => {
    setEditTitle(playlist.title);
    setEditDesc(playlist.description);
    setEditing(true);
  };

  const saveEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    updatePlaylist(playlist.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
    });
    setEditing(false);
    showToast('Playlist details updated');
  };

  const handleDelete = () => {
    deletePlaylist(playlist.id);
    showToast(`Deleted playlist "${playlist.title}"`);
    navigate('/playlists');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-lg border border-[#1F242D] bg-[#14171D] p-6 sm:flex-row sm:items-end">
        <img
          src={playlist.coverUrl}
          alt={playlist.title}
          className="h-44 w-44 shrink-0 rounded-md border border-[#262B36] object-cover"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="rounded border border-[#262B36] bg-[#0E1014] px-2 py-0.5 font-medium text-zinc-300">
              {playlist.isSystemRecommended ? 'Editorial Playlist' : 'Personal Playlist'}
            </span>
            <span>By {playlist.ownerName}</span>
          </div>

          {editing ? (
            <form onSubmit={saveEdits} className="space-y-3 max-w-lg">
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-1.5 text-lg font-semibold text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-[#262B36] bg-[#0E1014] px-3 py-1.5 text-xs text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
                {playlist.title}
              </h1>
              {playlist.description && (
                <p className="max-w-2xl text-sm text-zinc-400">{playlist.description}</p>
              )}
              <div className="text-xs text-zinc-400">
                {tracks.length} tracks | {formatTotalMinutes(totalMs)}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {tracks.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  isPlPlaying
                    ? togglePlayPause()
                    : playCollection(playlist.trackIds, 0, 'playlist', playlist.id)
                }
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
              >
                {isPlPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Play Playlist
                  </>
                )}
              </button>
            )}

            {tracks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  playlist.trackIds.forEach((tid) => addToQueue(tid));
                  showToast(`Queued ${playlist.trackIds.length} tracks`);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-[#262B36] bg-[#0E1014] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:border-[#2E3542]"
              >
                <ListPlus className="h-3.5 w-3.5" />
                Add to Queue
              </button>
            )}

            {isOwned && !editing && (
              <>
                <button
                  type="button"
                  onClick={() => setPickerOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-3.5 py-2 text-xs font-medium text-emerald-400 hover:border-emerald-500/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Tracks
                </button>
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-3 py-2 text-xs font-medium text-zinc-300 hover:border-[#2E3542]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-3 py-2 text-xs font-medium text-red-400 hover:border-red-500/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Track Picker for Owned Playlists */}
      {isOwned && pickerOpen && (
        <div className="rounded-md border border-[#262B36] bg-[#14171D] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Add Tracks from Catalog</h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Done
            </button>
          </div>
          {availableToAdd.length === 0 ? (
            <p className="text-xs text-zinc-500">All catalog tracks are already in this playlist.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
              {availableToAdd.map((track) => {
                const artist = getArtistById(track.artistId);
                return (
                  <div
                    key={track.id}
                    className="flex items-center justify-between gap-2 rounded border border-[#1F242D] bg-[#0E1014] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-100">{track.title}</p>
                      <p className="truncate text-[11px] text-zinc-400">{artist?.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addTrackToPlaylist(playlist.id, track.id);
                        showToast(`Added "${track.title}"`);
                      }}
                      className="shrink-0 rounded border border-emerald-500/40 bg-[#17231E] px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950"
                    >
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tracklist */}
      {tracks.length === 0 ? (
        <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-10 text-center text-sm text-zinc-400">
          This playlist has no tracks yet. Use Add Tracks above or add songs from any album page.
        </div>
      ) : (
        <div className="rounded-md border border-[#1F242D] bg-[#0E1014] p-2 space-y-0.5">
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              onPlay={() => playCollection(playlist.trackIds, idx, 'playlist', playlist.id)}
              playlistActions={
                isOwned
                  ? {
                      onMoveUp:
                        idx > 0
                          ? () => moveTrackInPlaylist(playlist.id, idx, idx - 1)
                          : undefined,
                      onMoveDown:
                        idx < tracks.length - 1
                          ? () => moveTrackInPlaylist(playlist.id, idx, idx + 1)
                          : undefined,
                      onRemove: () => {
                        removeTrackFromPlaylist(playlist.id, track.id);
                        showToast(`Removed "${track.title}"`);
                      },
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

