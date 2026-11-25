import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  Heart,
  ListPlus,
  Bookmark,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import type { Track } from '@soundsphere/shared';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { formatDuration } from '@/lib/formatters';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { useUiStore } from '@/stores/useUiStore';

interface TrackRowProps {
  track: Track;
  index?: number;
  showAlbum?: boolean;
  onPlay: () => void;
  playlistActions?: {
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onRemove?: () => void;
  };
}

export function TrackRow({
  track,
  index,
  showAlbum = true,
  onPlay,
  playlistActions,
}: TrackRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);

  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const userPlaylists = useLibraryStore((s) => s.userPlaylists);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);

  const notes = useMemoryStore((s) => s.notes);
  const noteCount = notes.filter((n) => n.trackId === track.id).length;

  const openQuickPin = useUiStore((s) => s.openQuickPin);
  const openCreatePlaylist = useUiStore((s) => s.openCreatePlaylist);
  const showToast = useUiStore((s) => s.showToast);

  const artist = useCatalogStore((s) => s.getArtistById(track.artistId));
  const album = useCatalogStore((s) => s.getAlbumById(track.albumId));
  const isCurrent = currentTrackId === track.id;
  const isFav = favoriteTrackIds.includes(track.id);

  const handleRowPlay = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      onPlay();
    }
  };

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
        isCurrent
          ? 'border-emerald-500/40 bg-[#161D1A]'
          : 'border-transparent hover:border-[#242A34] hover:bg-[#14171D]'
      }`}
    >
      {/* Index / Play button */}
      <div className="flex w-8 shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={handleRowPlay}
          aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium tabular-nums transition-colors ${
            isCurrent
              ? 'text-emerald-400'
              : 'text-zinc-500 group-hover:text-zinc-100'
          }`}
        >
          {isCurrent && isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <>
              <span className={isCurrent ? 'hidden' : 'group-hover:hidden'}>
                {index !== undefined ? index + 1 : track.trackNumber}
              </span>
              <Play
                className={`h-3.5 w-3.5 fill-current ${
                  isCurrent ? 'block' : 'hidden group-hover:block'
                }`}
              />
            </>
          )}
        </button>
      </div>

      {/* Artwork + Title + Artist */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {album && (
          <img
            src={album.coverUrl}
            alt={album.title}
            className="h-10 w-10 shrink-0 rounded border border-[#262B36] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRowPlay}
              className={`truncate text-left text-sm font-medium transition-colors ${
                isCurrent ? 'text-emerald-400' : 'text-zinc-100 hover:text-emerald-400'
              }`}
            >
              {track.title}
            </button>
            {track.isInstrumental && (
              <span className="hidden sm:inline-block shrink-0 rounded border border-[#262B36] bg-[#0E1014] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                Instrumental
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-400">
            {artist ? (
              <Link to={`/artist/${artist.id}`} className="truncate hover:text-zinc-200">
                {artist.name}
              </Link>
            ) : (
              <span>Unknown Artist</span>
            )}
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-500">{track.genre}</span>
          </div>
        </div>
      </div>

      {/* Album column */}
      {showAlbum && album && (
        <div className="hidden md:block w-44 shrink-0 truncate text-xs text-zinc-400">
          <Link to={`/album/${album.id}`} className="hover:text-zinc-200 transition-colors">
            {album.title}
          </Link>
        </div>
      )}

      {/* MemoryMix indicator */}
      <div className="hidden sm:flex w-16 shrink-0 items-center justify-end">
        {noteCount > 0 && (
          <Link
            to={`/memory-mix/song/${track.id}`}
            title={`${noteCount} MemoryMix entries`}
            className="inline-flex items-center gap-1 rounded border border-[#262B36] bg-[#0E1014] px-1.5 py-0.5 text-[11px] font-medium text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-400"
          >
            <Bookmark className="h-3 w-3 text-emerald-400" />
            {noteCount}
          </Link>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            toggleFavorite(track.id);
            showToast(isFav ? `Removed "${track.title}" from favorites` : `Saved "${track.title}" to favorites`);
          }}
          aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
          className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
            isFav
              ? 'text-emerald-400 hover:bg-[#1E242E]'
              : 'text-zinc-500 opacity-70 hover:bg-[#1E242E] hover:text-zinc-200 group-hover:opacity-100'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => openQuickPin(track.id, isCurrent ? currentTimeMs : 0)}
          title="Pin note in MemoryMix"
          aria-label="Pin note in MemoryMix"
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded text-zinc-500 opacity-70 hover:bg-[#1E242E] hover:text-emerald-400 group-hover:opacity-100 transition-colors"
        >
          <Bookmark className="h-4 w-4" />
        </button>

        <span className="w-11 text-right text-xs tabular-nums text-zinc-400">
          {formatDuration(track.durationMs)}
        </span>

        {playlistActions && (
          <div className="flex items-center gap-0.5 ml-1">
            {playlistActions.onMoveUp && (
              <button
                type="button"
                onClick={playlistActions.onMoveUp}
                title="Move track up"
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-[#1E242E] hover:text-zinc-200"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
            {playlistActions.onMoveDown && (
              <button
                type="button"
                onClick={playlistActions.onMoveDown}
                title="Move track down"
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-[#1E242E] hover:text-zinc-200"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            )}
            {playlistActions.onRemove && (
              <button
                type="button"
                onClick={playlistActions.onRemove}
                title="Remove from playlist"
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-red-950/50 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Context menu trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Track options"
            className="flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-[#1E242E] hover:text-zinc-200"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-9 z-40 w-52 rounded-md border border-[#2E3542] bg-[#14171D] p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    playNext(track.id);
                    showToast(`"${track.title}" will play next`);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#1E242E]"
                >
                  <ListPlus className="h-3.5 w-3.5 text-zinc-400" />
                  Play next
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addToQueue(track.id);
                    showToast(`Added "${track.title}" to queue`);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#1E242E]"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-400" />
                  Add to queue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openQuickPin(track.id, isCurrent ? currentTimeMs : 0);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#1E242E]"
                >
                  <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
                  Pin to MemoryMix
                </button>
                <div className="my-1 border-t border-[#232833]" />
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Add to playlist
                </div>
                {userPlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      addTrackToPlaylist(pl.id, track.id);
                      showToast(`Added to "${pl.title}"`);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#1E242E]"
                  >
                    <span className="truncate">{pl.title}</span>
                    {pl.trackIds.includes(track.id) && (
                      <span className="text-[10px] text-emerald-400">Added</span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openCreatePlaylist(track.id);
                  }}
                  className="mt-0.5 flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium text-emerald-400 hover:bg-[#1E242E]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New playlist
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

