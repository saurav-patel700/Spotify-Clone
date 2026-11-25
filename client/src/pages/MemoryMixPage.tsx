import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  BookMarked,
  Bookmark,
  Play,
  Plus,
  Pencil,
  Trash2,
  Check,
  Search,
  Tag,
  ArrowUpRight,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { formatDuration, formatRelativeDate } from '@/lib/formatters';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUiStore } from '@/stores/useUiStore';

const TAG_SWATCHES = ['#10B981', '#F59E0B', '#38BDF8', '#94A3B8', '#F43F5E'];
const SUGGESTED_TAGS = ['Motivation', 'Gym', 'Travel', 'Memories', 'Study'];

type SortOrder = 'recent' | 'oldest' | 'timestamp';

export function MemoryMixPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTrackFilter = searchParams.get('trackId') ?? 'all';

  const notes = useMemoryStore((s) => s.notes);
  const tags = useMemoryStore((s) => s.tags);
  const isLoading = useMemoryStore((s) => s.isLoading);
  const syncError = useMemoryStore((s) => s.syncError);
  const clearSyncError = useMemoryStore((s) => s.clearSyncError);
  const createNote = useMemoryStore((s) => s.createNote);
  const updateNote = useMemoryStore((s) => s.updateNote);
  const deleteNote = useMemoryStore((s) => s.deleteNote);
  const createTag = useMemoryStore((s) => s.createTag);
  const deleteTag = useMemoryStore((s) => s.deleteTag);

  const tracks = useCatalogStore((s) => s.tracks);
  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const showToast = useUiStore((s) => s.showToast);

  // Composer state
  const [composerTrackId, setComposerTrackId] = useState<string>(
    currentTrackId ?? tracks[0]?.id ?? ''
  );
  const [composerTimestampSec, setComposerTimestampSec] = useState<number>(
    Math.floor(currentTimeMs / 1000)
  );
  const [composerText, setComposerText] = useState('');
  const [composerBookmark, setComposerBookmark] = useState(true);
  const [composerTagIds, setComposerTagIds] = useState<string[]>([]);

  // Filter & sort state
  const [filterQuery, setFilterQuery] = useState('');
  const [filterTagId, setFilterTagId] = useState<string>('all');
  const [filterTrackId, setFilterTrackId] = useState<string>(initialTrackFilter);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');

  // Tag creator
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_SWATCHES[0]);

  // Inline edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteTags, setEditNoteTags] = useState<string[]>([]);

  const syncWithNowPlaying = () => {
    if (currentTrackId) {
      setComposerTrackId(currentTrackId);
      setComposerTimestampSec(Math.floor(currentTimeMs / 1000));
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() && !composerBookmark) return;
    const timestampMs = Math.max(0, Math.round(composerTimestampSec * 1000));
    const result = createNote({
      trackId: composerTrackId,
      timestampMs,
      noteText: composerText.trim() || `Bookmarked moment at ${formatDuration(timestampMs)}`,
      isBookmark: composerBookmark,
      tagIds: composerTagIds,
    });
    setComposerText('');
    setComposerTagIds([]);
    showToast(
      result.deduplicated
        ? `Updated existing bookmark at ${formatDuration(timestampMs)}`
        : `Saved MemoryMix entry at ${formatDuration(timestampMs)}`
    );
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTag(newTagName, newTagColor);
    showToast(`Created private tag "${newTagName.trim()}"`);
    setNewTagName('');
  };

  // Songs that have at least one saved journal entry
  const journaledSongs = useMemo(() => {
    const counts = new Map<string, { notes: number; bookmarks: number; latestAt: string }>();
    for (const n of notes) {
      const prev = counts.get(n.trackId) ?? { notes: 0, bookmarks: 0, latestAt: n.createdAt };
      counts.set(n.trackId, {
        notes: prev.notes + 1,
        bookmarks: prev.bookmarks + (n.isBookmark ? 1 : 0),
        latestAt: n.createdAt > prev.latestAt ? n.createdAt : prev.latestAt,
      });
    }
    return Array.from(counts.entries())
      .map(([trackId, stats]) => ({
        track: getTrackById(trackId),
        ...stats,
      }))
      .filter((item): item is { track: NonNullable<typeof item.track>; notes: number; bookmarks: number; latestAt: string } =>
        Boolean(item.track)
      )
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [notes, getTrackById]);

  const filteredNotes = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (bookmarksOnly && !n.isBookmark) return false;
      if (filterTagId !== 'all' && !n.tagIds.includes(filterTagId)) return false;
      if (filterTrackId !== 'all' && n.trackId !== filterTrackId) return false;
      if (q) {
        const track = getTrackById(n.trackId);
        const artist = track ? getArtistById(track.artistId) : undefined;
        const noteTagNames = tags
          .filter((t) => n.tagIds.includes(t.id))
          .map((t) => t.name.toLowerCase());
        const hit =
          n.noteText.toLowerCase().includes(q) ||
          (track?.title.toLowerCase().includes(q) ?? false) ||
          (artist?.name.toLowerCase().includes(q) ?? false) ||
          noteTagNames.some((name) => name.includes(q));
        if (!hit) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === 'oldest') return a.createdAt.localeCompare(b.createdAt);
      if (sortOrder === 'timestamp') return a.timestampMs - b.timestampMs;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes, tags, bookmarksOnly, filterTagId, filterTrackId, filterQuery, sortOrder, getTrackById, getArtistById]);

  const jumpToMoment = (trackId: string, timestampMs: number) => {
    playTrack(trackId, 'memory_mix', undefined, timestampMs);
    showToast(`Resumed playback at ${formatDuration(timestampMs)}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      {/* Editorial Header */}
      <div className="flex flex-col gap-3 border-b border-[#1F242D] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <BookMarked className="h-4 w-4" />
            MemoryMix Private Journal
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            Personal Listening Archive
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
            Attach private notes, custom tags, and exact playback timestamps to the songs you revisit.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-[#1F242D] bg-[#14171D] px-3 py-1.5 text-xs text-zinc-400">
          <Lock className="h-3.5 w-3.5 text-emerald-400" />
          <span>Private to your account</span>
          {isLoading && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-emerald-400" />}
        </div>
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

      {/* Saved Songs Quick Shelf (only shown when user has saved entries) */}
      {journaledSongs.length > 0 && (
        <section aria-labelledby="saved-songs-heading">
          <h2 id="saved-songs-heading" className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Saved Songs ({journaledSongs.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {journaledSongs.map(({ track, notes: nCount, bookmarks: bCount }) => {
              const artist = getArtistById(track.artistId);
              const album = getAlbumById(track.albumId);
              return (
                <Link
                  key={track.id}
                  to={`/memory-mix/song/${track.id}`}
                  className="group flex items-center justify-between gap-3 rounded-md border border-[#1F242D] bg-[#14171D] p-3 hover:border-[#2E3542] hover:bg-[#181C24] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {album && (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="h-12 w-12 shrink-0 rounded border border-[#262B36] object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-emerald-400 transition-colors">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-zinc-400">{artist?.name}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {nCount} {nCount === 1 ? 'entry' : 'entries'} | {bCount}{' '}
                        {bCount === 1 ? 'bookmark' : 'bookmarks'}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-emerald-400" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Composer & Personal Tags */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSaveEntry}
            className="rounded-lg border border-[#1F242D] bg-[#14171D] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">Write a Song Note</h2>
              {currentTrackId && (
                <button
                  type="button"
                  onClick={syncWithNowPlaying}
                  className="rounded border border-emerald-500/40 bg-[#15201B] px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-[#192822]"
                >
                  Capture Now ({formatDuration(currentTimeMs)})
                </button>
              )}
            </div>

            <div>
              <label htmlFor="mm-track" className="block text-[11px] font-medium text-zinc-400">
                Song
              </label>
              <select
                id="mm-track"
                value={composerTrackId}
                onChange={(e) => setComposerTrackId(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {tracks.map((t) => {
                  const artist = getArtistById(t.artistId);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.title} ({artist?.name})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="mm-ts" className="block text-[11px] font-medium text-zinc-400">
                Timestamp (seconds) | {formatDuration(composerTimestampSec * 1000)}
              </label>
              <input
                id="mm-ts"
                type="number"
                min={0}
                max={600}
                value={composerTimestampSec}
                onChange={(e) => setComposerTimestampSec(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs tabular-nums text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="mm-note" className="block text-[11px] font-medium text-zinc-400">
                Personal Note
              </label>
              <textarea
                id="mm-note"
                rows={4}
                maxLength={2000}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="Write a personal memory, reflection, or production detail for this song..."
                className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-[11px] font-medium text-zinc-400">Attach Personal Tags</span>
              {tags.length === 0 ? (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Create a tag below first to attach labels to your notes.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = composerTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setComposerTagIds((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${
                          selected
                            ? 'border-emerald-500/60 bg-[#17231E] text-emerald-300'
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
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={composerBookmark}
                onChange={(e) => setComposerBookmark(e.target.checked)}
                className="h-4 w-4 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
              />
              Save timestamp bookmark on seek bar
            </label>

            <button
              type="submit"
              className="w-full rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              Save to Journal
            </button>
          </form>

          {/* Personal Tags Manager */}
          <div className="rounded-lg border border-[#1F242D] bg-[#14171D] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Personal Tags</h2>
            </div>

            <form onSubmit={handleCreateTag} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={28}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Create tag (e.g. Travel)"
                aria-label="New personal tag name"
                className="flex-1 rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Create tag"
                className="inline-flex items-center gap-1 rounded-md border border-[#262B36] bg-[#1B1F27] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-emerald-500/40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </form>

            <div className="flex items-center gap-2">
              {TAG_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setNewTagColor(hex)}
                  aria-label={`Select color ${hex}`}
                  className={`h-5 w-5 rounded border ${
                    newTagColor === hex ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>

            {/* Quick-add tag suggestions (only created when clicked by user) */}
            <div className="space-y-1.5">
              <span className="block text-[11px] text-zinc-500">Quick add</span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.filter(
                  (name) => !tags.some((t) => t.name.toLowerCase() === name.toLowerCase())
                ).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      createTag(name, newTagColor);
                      showToast(`Created tag "${name}"`);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#2E3542] bg-[#0E1014] px-2 py-1 text-[11px] text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-400"
                  >
                    <Plus className="h-3 w-3" />
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#1F242D]">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-2.5 py-1 text-xs text-zinc-300"
                  >
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: tag.colorHex }}
                    />
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => deleteTag(tag.id)}
                      aria-label={`Delete tag ${tag.name}`}
                      className="ml-1 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Editorial Journal Feed */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search, Filter, Sort Bar */}
          <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-3.5 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="search"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search notes, songs, artists, or tags..."
                  aria-label="Search journal notes"
                  className="h-9 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={filterTrackId}
                onChange={(e) => {
                  setFilterTrackId(e.target.value);
                  setSearchParams(
                    e.target.value === 'all' ? {} : { trackId: e.target.value },
                    { replace: true }
                  );
                }}
                aria-label="Filter by song"
                className="h-9 rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Songs</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                aria-label="Sort journal entries"
                className="h-9 rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="recent">Recently Added</option>
                <option value="oldest">Oldest First</option>
                <option value="timestamp">Song Timestamp</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterTagId('all')}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                    filterTagId === 'all'
                      ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                      : 'border-[#262B36] bg-[#0E1014] text-zinc-400'
                  }`}
                >
                  All Tags
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setFilterTagId(tag.id)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                      filterTagId === tag.id
                        ? 'border-emerald-500/50 bg-[#17231E] text-emerald-400'
                        : 'border-[#262B36] bg-[#0E1014] text-zinc-400'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookmarksOnly}
                  onChange={(e) => setBookmarksOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
                />
                Bookmarks only
              </label>
            </div>
          </div>

          {/* Empty State vs Editorial Entries */}
          {notes.length === 0 ? (
            <div className="rounded-lg border border-[#1F242D] bg-[#14171D] p-10 text-center space-y-2">
              <BookMarked className="mx-auto h-7 w-7 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-100">Your MemoryMix journal is empty</h3>
              <p className="mx-auto max-w-md text-xs text-zinc-400 leading-relaxed">
                Write a private note on the left or click Pin in the bottom audio player while listening to capture a timestamped bookmark.
              </p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="rounded-md border border-[#1F242D] bg-[#14171D] p-10 text-center text-sm text-zinc-400">
              No journal entries match the current search or tag filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const track = getTrackById(note.trackId);
                const artist = track ? getArtistById(track.artistId) : undefined;
                const album = track ? getAlbumById(track.albumId) : undefined;
                const noteTags = tags.filter((t) => note.tagIds.includes(t.id));
                const isEditing = editingNoteId === note.id;

                return (
                  <article
                    key={note.id}
                    className="rounded-lg border border-[#1F242D] bg-[#14171D] p-5 space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {album && (
                          <Link to={`/memory-mix/song/${note.trackId}`} className="shrink-0">
                            <img
                              src={album.coverUrl}
                              alt={album.title}
                              className="h-11 w-11 rounded border border-[#262B36] object-cover"
                            />
                          </Link>
                        )}
                        <div className="min-w-0">
                          <Link
                            to={`/memory-mix/song/${note.trackId}`}
                            className="block truncate text-sm font-semibold text-zinc-100 hover:text-emerald-400"
                          >
                            {track?.title ?? 'Unknown Track'}
                          </Link>
                          <p className="truncate text-xs text-zinc-400">
                            {artist?.name} | {formatRelativeDate(note.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => jumpToMoment(note.trackId, note.timestampMs)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-[#15201B] px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 transition-colors"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          {formatDuration(note.timestampMs)}
                        </button>
                        {note.isBookmark && (
                          <span
                            title="Pinned bookmark on player progress bar"
                            className="rounded border border-amber-500/40 bg-amber-500/10 p-1 text-amber-400"
                          >
                            <Bookmark className="h-3.5 w-3.5 fill-current" />
                          </span>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 border-t border-[#1F242D] pt-3">
                        <textarea
                          rows={3}
                          value={editNoteText}
                          onChange={(e) => setEditNoteText(e.target.value)}
                          className="w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                        />
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag) => {
                              const active = editNoteTags.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() =>
                                    setEditNoteTags((prev) =>
                                      prev.includes(tag.id)
                                        ? prev.filter((id) => id !== tag.id)
                                        : [...prev, tag.id]
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] ${
                                    active
                                      ? 'border-emerald-500/60 bg-[#17231E] text-emerald-300'
                                      : 'border-[#262B36] bg-[#0E1014] text-zinc-400'
                                  }`}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-sm"
                                    style={{ backgroundColor: tag.colorHex }}
                                  />
                                  {tag.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              updateNote(note.id, {
                                noteText: editNoteText,
                                tagIds: editNoteTags,
                              });
                              setEditingNoteId(null);
                              showToast('Updated journal entry');
                            }}
                            className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
                          >
                            <Check className="h-3 w-3" />
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="rounded border border-[#262B36] px-3 py-1.5 text-xs text-zinc-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="border-l-2 border-[#262B36] pl-3.5 text-sm text-zinc-200 leading-relaxed">
                        {note.noteText}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {noteTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1.5 rounded border border-[#262B36] bg-[#0E1014] px-2 py-0.5 text-[11px] text-zinc-300"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-sm"
                              style={{ backgroundColor: tag.colorHex }}
                            />
                            {tag.name}
                          </span>
                        ))}
                        <Link
                          to={`/memory-mix/song/${note.trackId}`}
                          className="text-[11px] font-medium text-zinc-500 hover:text-emerald-400"
                        >
                          Song Memory Page
                        </Link>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditNoteText(note.noteText);
                            setEditNoteTags(note.tagIds);
                          }}
                          aria-label="Edit note"
                          className="rounded p-1.5 text-zinc-500 hover:bg-[#1E242E] hover:text-zinc-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteNote(note.id);
                            showToast('Deleted MemoryMix entry');
                          }}
                          aria-label="Delete note"
                          className="rounded p-1.5 text-zinc-500 hover:bg-red-950/50 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
