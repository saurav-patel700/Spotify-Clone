import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  BookMarked,
  Check,
  Clock,
  Lock,
  Pause,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { formatDuration, formatRelativeDate } from '@/lib/formatters';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useMemoryStore } from '@/stores/useMemoryStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUiStore } from '@/stores/useUiStore';

export function SongMemoryPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const getTrackById = useCatalogStore((s) => s.getTrackById);
  const getArtistById = useCatalogStore((s) => s.getArtistById);
  const getAlbumById = useCatalogStore((s) => s.getAlbumById);

  const track = trackId ? getTrackById(trackId) : undefined;
  const artist = track ? getArtistById(track.artistId) : undefined;
  const album = track ? getAlbumById(track.albumId) : undefined;

  const notes = useMemoryStore((s) => s.notes);
  const tags = useMemoryStore((s) => s.tags);
  const createNote = useMemoryStore((s) => s.createNote);
  const updateNote = useMemoryStore((s) => s.updateNote);
  const deleteNote = useMemoryStore((s) => s.deleteNote);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTimeMs = usePlayerStore((s) => s.currentTimeMs);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const showToast = useUiStore((s) => s.showToast);

  const [noteText, setNoteText] = useState('');
  const [timestampSec, setTimestampSec] = useState(0);
  const [isBookmark, setIsBookmark] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const songNotes = useMemo(() => {
    if (!track) return [];
    return notes
      .filter((n) => n.trackId === track.id)
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }, [notes, track]);

  const savedBookmarks = useMemo(
    () => songNotes.filter((n) => n.isBookmark),
    [songNotes]
  );

  const attachedTags = useMemo(() => {
    const usedIds = new Set(songNotes.flatMap((n) => n.tagIds));
    return tags.filter((t) => usedIds.has(t.id));
  }, [songNotes, tags]);

  if (!track || !album) {
    return (
      <div className="mx-auto max-w-4xl rounded-md border border-[#1F242D] bg-[#14171D] p-8 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Song not found</h1>
        <Link to="/memory-mix" className="mt-3 inline-block text-xs font-medium text-emerald-400">
          Return to MemoryMix Journal
        </Link>
      </div>
    );
  }

  const isCurrentTrack = currentTrackId === track.id;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() && !isBookmark) return;
    const tsMs = Math.max(0, Math.min(track.durationMs, Math.round(timestampSec * 1000)));
    const result = createNote({
      trackId: track.id,
      timestampMs: tsMs,
      noteText: noteText.trim() || `Bookmarked moment at ${formatDuration(tsMs)}`,
      isBookmark,
      tagIds: selectedTagIds,
    });
    setNoteText('');
    setSelectedTagIds([]);
    showToast(
      result.deduplicated
        ? `Updated bookmark at ${formatDuration(tsMs)}`
        : `Saved note at ${formatDuration(tsMs)}`
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-8">
      <div className="flex items-center justify-between">
        <Link
          to="/memory-mix"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to MemoryMix Journal
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          <Lock className="h-3.5 w-3.5 text-emerald-400" />
          Private Song Memory
        </span>
      </div>

      {/* Song & Album Artwork Header */}
      <div className="flex flex-col gap-6 rounded-lg border border-[#1F242D] bg-[#14171D] p-6 sm:flex-row sm:items-end">
        <img
          src={album.coverUrl}
          alt={album.title}
          className="h-44 w-44 shrink-0 rounded-md border border-[#262B36] object-cover"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded border border-[#262B36] bg-[#0E1014] px-2 py-0.5 font-medium text-emerald-400">
              {track.genre}
            </span>
            <span>{track.bpm} BPM</span>
            <span>|</span>
            <span>{formatDuration(track.durationMs)}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            {track.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {artist && (
              <Link to={`/artist/${artist.id}`} className="font-semibold text-zinc-200 hover:text-emerald-400">
                {artist.name}
              </Link>
            )}
            <span>|</span>
            <Link to={`/album/${album.id}`} className="hover:text-zinc-200">
              {album.title}
            </Link>
          </div>

          {/* User-created tags attached to this song */}
          {attachedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {attachedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded border border-[#262B36] bg-[#0E1014] px-2.5 py-1 text-xs text-zinc-200"
                >
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: tag.colorHex }} />
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() =>
                isCurrentTrack ? togglePlayPause() : playTrack(track.id, 'memory_mix')
              }
              className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              {isCurrentTrack && isPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" />
                  Pause Song
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Play Song
                </>
              )}
            </button>

            {isCurrentTrack && (
              <button
                type="button"
                onClick={() => setTimestampSec(Math.floor(currentTimeMs / 1000))}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-[#15201B] px-3.5 py-2 text-xs font-medium text-emerald-400"
              >
                <Clock className="h-3.5 w-3.5" />
                Use Current Position ({formatDuration(currentTimeMs)})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visual Bookmark Timeline */}
      <section className="rounded-lg border border-[#1F242D] bg-[#14171D] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">
            Saved Timestamps ({savedBookmarks.length})
          </h2>
          <span className="text-xs tabular-nums text-zinc-500">
            0:00 to {formatDuration(track.durationMs)}
          </span>
        </div>

        <div className="relative h-8 rounded border border-[#262B36] bg-[#0A0B0D] px-2 flex items-center">
          <div className="h-1 w-full rounded bg-[#1F242D]" />
          {isCurrentTrack && (
            <div
              className="absolute top-1 bottom-1 w-0.5 bg-emerald-400"
              style={{
                left: `${Math.min(99, Math.max(1, (currentTimeMs / Math.max(1, track.durationMs)) * 100))}%`,
              }}
            />
          )}
          {savedBookmarks.map((pin) => {
            const pct = Math.min(98, Math.max(2, (pin.timestampMs / Math.max(1, track.durationMs)) * 100));
            return (
              <button
                key={pin.id}
                type="button"
                onClick={() => playTrack(track.id, 'memory_mix', undefined, pin.timestampMs)}
                title={`Resume at ${formatDuration(pin.timestampMs)}: ${pin.noteText}`}
                style={{ left: `${pct}%` }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-5 w-2.5 items-center justify-center rounded-sm bg-amber-400 hover:bg-amber-300"
                aria-label={`Resume at ${formatDuration(pin.timestampMs)}`}
              />
            );
          })}
        </div>

        {savedBookmarks.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No timestamps bookmarked for this song yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {savedBookmarks.map((pin) => (
              <button
                key={pin.id}
                type="button"
                onClick={() => playTrack(track.id, 'memory_mix', undefined, pin.timestampMs)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#262B36] bg-[#0E1014] px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-400"
              >
                <Bookmark className="h-3 w-3 text-amber-400 fill-current" />
                <span className="tabular-nums font-semibold">{formatDuration(pin.timestampMs)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Add Note Form */}
        <form
          onSubmit={handleAddNote}
          className="lg:col-span-5 rounded-lg border border-[#1F242D] bg-[#14171D] p-5 space-y-4 self-start"
        >
          <h2 className="text-sm font-semibold text-zinc-100">Add Note for {track.title}</h2>

          <div>
            <label htmlFor="sm-ts" className="block text-[11px] font-medium text-zinc-400">
              Timestamp (seconds) | {formatDuration(timestampSec * 1000)}
            </label>
            <input
              id="sm-ts"
              type="number"
              min={0}
              max={Math.floor(track.durationMs / 1000)}
              value={timestampSec}
              onChange={(e) => setTimestampSec(Math.max(0, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs tabular-nums text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="sm-note" className="block text-[11px] font-medium text-zinc-400">
              Note
            </label>
            <textarea
              id="sm-note"
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a personal note for this track..."
              className="mt-1 w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {tags.length > 0 && (
            <div>
              <span className="block text-[11px] font-medium text-zinc-400">Tags</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setSelectedTagIds((prev) =>
                          prev.includes(tag.id)
                            ? prev.filter((id) => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${
                        active
                          ? 'border-emerald-500/60 bg-[#17231E] text-emerald-300'
                          : 'border-[#262B36] bg-[#0E1014] text-zinc-400'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: tag.colorHex }} />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isBookmark}
              onChange={(e) => setIsBookmark(e.target.checked)}
              className="h-4 w-4 rounded border-[#262B36] bg-[#0A0B0D] accent-emerald-500"
            />
            Save as clickable timestamp bookmark
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Save Note
          </button>
        </form>

        {/* Personal Notes List */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-100">
            Personal Notes ({songNotes.length})
          </h2>

          {songNotes.length === 0 ? (
            <div className="rounded-lg border border-[#1F242D] bg-[#14171D] p-8 text-center space-y-2">
              <BookMarked className="mx-auto h-6 w-6 text-zinc-500" />
              <p className="text-xs text-zinc-400">
                No personal notes saved for this song yet.
              </p>
            </div>
          ) : (
            songNotes.map((note) => {
              const noteTags = tags.filter((t) => note.tagIds.includes(t.id));
              const isEditing = editingId === note.id;

              return (
                <article
                  key={note.id}
                  className="rounded-lg border border-[#1F242D] bg-[#14171D] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => playTrack(track.id, 'memory_mix', undefined, note.timestampMs)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-[#15201B] px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 transition-colors"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      {formatDuration(note.timestampMs)}
                    </button>
                    <span className="text-[11px] text-zinc-500">
                      {formatRelativeDate(note.createdAt)}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full rounded-md border border-[#262B36] bg-[#0A0B0D] px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateNote(note.id, { noteText: editText });
                            setEditingId(null);
                            showToast('Updated note');
                          }}
                          className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-zinc-950"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded border border-[#262B36] px-2.5 py-1 text-xs text-zinc-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="border-l-2 border-[#262B36] pl-3 text-sm text-zinc-200 leading-relaxed">
                      {note.noteText}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {noteTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1.5 rounded border border-[#262B36] bg-[#0E1014] px-2 py-0.5 text-[11px] text-zinc-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: tag.colorHex }} />
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditText(note.noteText);
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
                          showToast('Deleted note');
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
