import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { formatDuration } from '@/lib/formatters';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { useUiStore } from '@/stores/useUiStore';

export function BottomPlayer() {
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const audioStatus = usePlayerStore((s) => s.audioStatus);
  const audioError = usePlayerStore((s) => s.audioError);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const isMobileSheetOpen = usePlayerStore((s) => s.isMobileSheetOpen);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const retryCurrentTrack = usePlayerStore((s) => s.retryCurrentTrack);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleQueueOpen = usePlayerStore((s) => s.toggleQueueOpen);
  const setMobileSheetOpen = usePlayerStore((s) => s.setMobileSheetOpen);

  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const notes = useMemoryStore((s) => s.notes);
  const openQuickPin = useUiStore((s) => s.openQuickPin);
  const showToast = useUiStore((s) => s.showToast);

  const [isDragging, setIsDragging] = useState(false);
  const [dragTimeMs, setDragTimeMs] = useState(0);

  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);

  const track = currentTrackId ? getTrackById(currentTrackId) : undefined;
  const artist = track ? getArtistById(track.artistId) : undefined;
  const album = track ? getAlbumById(track.albumId) : undefined;
  const isFav = track ? favoriteTrackIds.includes(track.id) : false;

  const trackBookmarks = track
    ? notes.filter((n) => n.trackId === track.id && n.isBookmark)
    : [];

  const safeDuration = Math.max(1, durationMs || track?.durationMs || 1);
  const displayedTimeMs = isDragging ? dragTimeMs : currentTimeMs;
  const progressPct = Math.min(100, Math.max(0, (displayedTimeMs / safeDuration) * 100));
  const effectiveVolume = muted ? 0 : volume;
  const isLoadingAudio = audioStatus === 'loading';

  const progressTrackStyle = {
    background: `linear-gradient(to right, #10B981 ${progressPct}%, #262B36 ${progressPct}%)`,
  };

  const volumeTrackStyle = {
    background: `linear-gradient(to right, #10B981 ${effectiveVolume * 100}%, #262B36 ${effectiveVolume * 100}%)`,
  };

  const handleSliderInput = (val: number) => {
    setDragTimeMs(val);
    if (!isDragging) {
      seek(val);
    }
  };

  const commitSliderSeek = () => {
    if (isDragging) {
      seek(dragTimeMs);
      setIsDragging(false);
    }
  };

  if (!track || !album) return null;

  return (
    <>
      {/* Playback Error Banner */}
      {audioError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-t border-red-500/35 bg-[#1B1113] px-4 py-2 text-xs text-red-200 lg:px-6"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="truncate">{audioError}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={retryCurrentTrack}
              className="inline-flex items-center gap-1 rounded border border-red-400/40 bg-red-950/50 px-2.5 py-1 text-[11px] font-medium text-red-200 hover:bg-red-900/50"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </button>
            <button
              type="button"
              onClick={nextTrack}
              className="rounded border border-[#2E3542] bg-[#14171D] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#1B1F27]"
            >
              Skip Next
            </button>
          </div>
        </div>
      )}

      {/* Desktop & Tablet Bottom Player Bar */}
      <footer className="hidden md:flex h-20 shrink-0 items-center justify-between gap-4 border-t border-[#1F242D] bg-[#0E1014] px-4 lg:px-6">
        {/* Left: Artwork + Track & Artist Info */}
        <div className="flex w-72 min-w-0 items-center gap-3">
          <Link to={`/album/${album.id}`} className="shrink-0">
            <img
              src={album.coverUrl}
              alt={album.title}
              className="h-12 w-12 rounded-md border border-[#262B36] object-cover"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to={`/album/${album.id}`}
              className="block truncate text-sm font-medium text-zinc-100 hover:text-emerald-400 transition-colors"
            >
              {track.title}
            </Link>
            <Link
              to={`/artist/${track.artistId}`}
              className="block truncate text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {artist?.name ?? 'Unknown Artist'}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => {
              toggleFavorite(track.id);
              showToast(
                isFav
                  ? `Removed "${track.title}" from favorites`
                  : `Saved "${track.title}" to favorites`
              );
            }}
            aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
            className={`shrink-0 rounded p-1.5 transition-colors ${
              isFav ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center: Transport Controls + Progress Bar */}
        <div className="flex max-w-xl flex-1 flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleShuffle}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              className={`rounded p-1.5 transition-colors ${
                shuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={prevTrack}
              aria-label="Previous track"
              className="rounded-md p-1.5 text-zinc-200 hover:bg-[#1B1F27] transition-colors"
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isLoadingAudio ? 'Loading audio' : isPlaying ? 'Pause' : 'Play'}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={nextTrack}
              aria-label="Next track"
              className="rounded-md p-1.5 text-zinc-200 hover:bg-[#1B1F27] transition-colors"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={`Repeat mode: ${repeatMode}`}
              className={`rounded p-1.5 transition-colors ${
                repeatMode !== 'off' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="h-3.5 w-3.5" />
              ) : (
                <Repeat className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex w-full items-center gap-2.5">
            <span
              data-testid="player-current-time"
              className="w-10 text-right text-[11px] tabular-nums text-zinc-400"
            >
              {formatDuration(displayedTimeMs)}
            </span>

            <div className="relative flex flex-1 items-center">
              <input
                type="range"
                min={0}
                max={safeDuration}
                value={Math.min(displayedTimeMs, safeDuration)}
                onPointerDown={() => {
                  setIsDragging(true);
                  setDragTimeMs(currentTimeMs);
                }}
                onChange={(e) => handleSliderInput(Number(e.target.value))}
                onPointerUp={commitSliderSeek}
                onKeyUp={commitSliderSeek}
                aria-label="Seek track progress"
                style={progressTrackStyle}
                className="ss-range w-full"
              />
              {trackBookmarks.map((pin) => {
                const leftPct = Math.min(98, Math.max(2, (pin.timestampMs / safeDuration) * 100));
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => seek(pin.timestampMs)}
                    title={`MemoryMix (${formatDuration(pin.timestampMs)}): ${pin.noteText}`}
                    aria-label={`Jump to bookmark at ${formatDuration(pin.timestampMs)}`}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-amber-400 hover:bg-amber-300"
                  />
                );
              })}
            </div>

            <span
              data-testid="player-duration"
              className="w-10 text-[11px] tabular-nums text-zinc-400"
            >
              {formatDuration(safeDuration)}
            </span>
          </div>
        </div>

        {/* Right: MemoryMix Pin, Volume, Queue */}
        <div className="flex w-64 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openQuickPin(track.id, currentTimeMs)}
            title="Pin current timestamp in MemoryMix"
            aria-label="Pin current timestamp in MemoryMix"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#1F242D] bg-[#14171D] px-2.5 text-xs font-medium text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Pin</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="rounded p-1.5 text-zinc-400 hover:text-zinc-200"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={effectiveVolume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              style={volumeTrackStyle}
              className="ss-range w-20"
            />
          </div>

          <button
            type="button"
            onClick={toggleQueueOpen}
            aria-label="Toggle queue"
            className={`rounded-md border p-1.5 transition-colors ${
              isQueueOpen
                ? 'border-emerald-500/50 bg-[#171E1C] text-emerald-400'
                : 'border-[#1F242D] bg-[#14171D] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ListMusic className="h-4 w-4" />
          </button>
        </div>
      </footer>

      {/* Mobile Compact Mini-Player */}
      <div className="md:hidden border-t border-[#1F242D] bg-[#0E1014]">
        <div className="h-0.5 w-full bg-[#1F242D]">
          <div className="h-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <button
            type="button"
            onClick={() => setMobileSheetOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <img
              src={album.coverUrl}
              alt={album.title}
              className="h-10 w-10 shrink-0 rounded border border-[#262B36] object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-100">{track.title}</p>
              <p className="truncate text-[11px] text-zinc-400">{artist?.name}</p>
            </div>
            <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-zinc-950"
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={nextTrack}
              aria-label="Next track"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Full-Screen Now Playing Sheet */}
      {isMobileSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0B0D] p-5 md:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(false)}
              aria-label="Close player sheet"
              className="rounded-md border border-[#1F242D] bg-[#14171D] p-2 text-zinc-300"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Now Playing
            </span>
            <button
              type="button"
              onClick={() => {
                setMobileSheetOpen(false);
                toggleQueueOpen();
              }}
              aria-label="Open queue"
              className="rounded-md border border-[#1F242D] bg-[#14171D] p-2 text-zinc-300"
            >
              <ListMusic className="h-4 w-4" />
            </button>
          </div>

          <div className="my-auto flex flex-col items-center">
            <img
              src={album.coverUrl}
              alt={album.title}
              className="w-full max-w-xs aspect-square rounded-lg border border-[#262B36] object-cover"
            />

            <div className="mt-6 flex w-full max-w-xs items-center justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-zinc-100">{track.title}</h3>
                <p className="truncate text-sm text-zinc-400">{artist?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(track.id)}
                aria-label="Favorite track"
                className={`p-2 ${isFav ? 'text-emerald-400' : 'text-zinc-400'}`}
              >
                <Heart className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="mt-5 w-full max-w-xs">
              <input
                type="range"
                min={0}
                max={safeDuration}
                value={Math.min(displayedTimeMs, safeDuration)}
                onPointerDown={() => {
                  setIsDragging(true);
                  setDragTimeMs(currentTimeMs);
                }}
                onChange={(e) => handleSliderInput(Number(e.target.value))}
                onPointerUp={commitSliderSeek}
                style={progressTrackStyle}
                className="ss-range w-full"
              />
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-zinc-400">
                <span>{formatDuration(displayedTimeMs)}</span>
                <span>{formatDuration(safeDuration)}</span>
              </div>
            </div>

            <div className="mt-6 flex w-full max-w-xs items-center justify-between">
              <button
                type="button"
                onClick={toggleShuffle}
                className={shuffle ? 'text-emerald-400' : 'text-zinc-400'}
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button type="button" onClick={prevTrack} className="text-zinc-100">
                <SkipBack className="h-6 w-6 fill-current" />
              </button>
              <button
                type="button"
                onClick={togglePlayPause}
                className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-500 text-zinc-950"
              >
                {isLoadingAudio ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                )}
              </button>
              <button type="button" onClick={nextTrack} className="text-zinc-100">
                <SkipForward className="h-6 w-6 fill-current" />
              </button>
              <button
                type="button"
                onClick={cycleRepeat}
                className={repeatMode !== 'off' ? 'text-emerald-400' : 'text-zinc-400'}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="h-5 w-5" />
                ) : (
                  <Repeat className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mt-6 flex w-full max-w-xs items-center justify-between gap-4">
              <div className="flex flex-1 items-center gap-2">
                <Volume2 className="h-4 w-4 text-zinc-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={effectiveVolume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  style={volumeTrackStyle}
                  className="ss-range flex-1"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileSheetOpen(false);
                  openQuickPin(track.id, currentTimeMs);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#14171D] px-3 py-1.5 text-xs font-medium text-emerald-400"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Pin Note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
