import { useState, useEffect } from 'react';
import { X, Bookmark, ListMusic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { formatDuration } from '@/lib/formatters';
import { useUiStore } from '@/stores/useUiStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useMemoryStore } from '@/stores/useMemoryStore';

export function AppModals() {
  const navigate = useNavigate();

  const isCreatePlaylistOpen = useUiStore((s) => s.isCreatePlaylistOpen);
  const createPlaylistInitialTrackId = useUiStore((s) => s.createPlaylistInitialTrackId);
  const closeCreatePlaylist = useUiStore((s) => s.closeCreatePlaylist);

  const quickPinTrackId = useUiStore((s) => s.quickPinTrackId);
  const quickPinTimestampMs = useUiStore((s) => s.quickPinTimestampMs);
  const closeQuickPin = useUiStore((s) => s.closeQuickPin);
  const showToast = useUiStore((s) => s.showToast);

  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const tags = useMemoryStore((s) => s.tags);
  const createNote = useMemoryStore((s) => s.createNote);

  const [plTitle, setPlTitle] = useState('');
  const [plDesc, setPlDesc] = useState('');

  const [noteText, setNoteText] = useState('');
  const [isBookmark, setIsBookmark] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (isCreatePlaylistOpen) {
      setPlTitle('');
      setPlDesc('');
    }
  }, [isCreatePlaylistOpen]);

  useEffect(() => {
    if (quickPinTrackId) {
      setNoteText('');
      setIsBookmark(true);
      setSelectedTagIds([]);
    }
  }, [quickPinTrackId]);

  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const pinnedTrack = quickPinTrackId ? getTrackById(quickPinTrackId) : undefined;
  const pinnedArtist = pinnedTrack ? getArtistById(pinnedTrack.artistId) : undefined;

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plTitle.trim()) return;
    const created = createPlaylist(plTitle, plDesc, createPlaylistInitialTrackId ?? undefined);
    closeCreatePlaylist();
    showToast(`Created playlist "${created.title}"`);
    navigate(`/playlist/${created.id}`);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinnedTrack) return;
    if (!noteText.trim() && !isBookmark) return;
    const result = createNote({
      trackId: pinnedTrack.id,
      timestampMs: quickPinTimestampMs,
      noteText: noteText.trim() || `Bookmarked at ${formatDuration(quickPinTimestampMs)}`,
      isBookmark,
      tagIds: selectedTagIds,
    });
    closeQuickPin();
    showToast(
      result.deduplicated
        ? `Updated existing bookmark at ${formatDuration(quickPinTimestampMs)}`
        : `Saved MemoryMix entry at ${formatDuration(quickPinTimestampMs)}`
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <>
      {isCreatePlaylistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#262B36] bg-[#14171D] p-5">
            <div className="flex items-center justify-between border-b border-[#1F242D] pb-3">
              <div className="flex items-center gap-2">
                <ListMusic className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-zinc-100">Create Playlist</h2>
              </div>
              <button
                type="button"
                onClick={closeCreatePlaylist}
                aria-label="Close dialog"
                className="rounded p-1 text-zinc-400 hover:bg-[#1E242E] hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylistSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300">Playlist Name</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={plTitle}
                  onChange={(e) => setPlTitle(e.target.value)}
                  placeholder="Evening Architecture"
                  className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300">Description</label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={plDesc}
                  onChange={(e) => setPlDesc(e.target.value)}
                  placeholder="Optional notes about the mood or purpose of this collection"
                  className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreatePlaylist}
                  className="rounded-md border border-[#262B36] bg-[#1B1F27] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-[#222732]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pinnedTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#262B36] bg-[#14171D] p-5">
            <div className="flex items-center justify-between border-b border-[#1F242D] pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-zinc-100">Pin to MemoryMix</h2>
              </div>
              <button
                type="button"
                onClick={closeQuickPin}
                aria-label="Close dialog"
                className="rounded p-1 text-zinc-400 hover:bg-[#1E242E] hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-md border border-[#1F242D] bg-[#0E1014] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{pinnedTrack.title}</p>
                <p className="truncate text-xs text-zinc-400">{pinnedArtist?.name}</p>
              </div>
              <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold tabular-nums text-emerald-400">
                {formatDuration(quickPinTimestampMs)}
              </span>
            </div>

            <form onSubmit={handlePinSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300">Listening Note</label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write what stood out at this timestamp, a focus cue, or a memory"
                  className="mt-1.5 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-zinc-300">Private Tags</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                            : 'border-[#262B36] bg-[#0E1014] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: tag.colorHex }}
                        />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBookmark}
                  onChange={(e) => setIsBookmark(e.target.checked)}
                  className="h-4 w-4 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
                />
                Mark as timeline bookmark on seek bar
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeQuickPin}
                  className="rounded-md border border-[#262B36] bg-[#1B1F27] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-[#222732]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

