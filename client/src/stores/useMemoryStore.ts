import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MemoryNote, UserTag } from '@soundsphere/shared';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from './useAuthStore';

interface MemoryState {
  ownerId: string | null;
  notes: MemoryNote[];
  tags: UserTag[];
  isLoading: boolean;
  syncError: string | null;

  hydrateMemory: (userId: string) => Promise<void>;
  clearMemory: () => void;
  clearSyncError: () => void;
  createNote: (input: {
    trackId: string;
    timestampMs: number;
    noteText: string;
    isBookmark: boolean;
    tagIds: string[];
  }) => { note: MemoryNote; deduplicated: boolean };
  updateNote: (
    id: string,
    updates: { noteText?: string; isBookmark?: boolean; tagIds?: string[]; timestampMs?: number }
  ) => void;
  deleteNote: (id: string) => void;
  createTag: (name: string, colorHex: string) => UserTag;
  deleteTag: (id: string) => void;
  getNotesForTrack: (trackId: string) => MemoryNote[];
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      notes: [],
      tags: [],
      isLoading: false,
      syncError: null,

      hydrateMemory: async (userId: string) => {
        if (!useAuthStore.getState().accessToken) {
          set({ ownerId: null, notes: [], tags: [], isLoading: false });
          return;
        }
        const prevOwner = get().ownerId;
        if (prevOwner && prevOwner !== userId) {
          set({ ownerId: userId, notes: [], tags: [] });
        } else {
          set({ ownerId: userId });
        }

        set({ isLoading: true, syncError: null });
        try {
          const data = await apiClient.getMemoryJournal();
          set({
            ownerId: userId,
            notes: data.notes,
            tags: data.tags,
            isLoading: false,
          });
        } catch {
          set({ isLoading: false });
        }
      },

      clearMemory: () =>
        set({
          ownerId: null,
          notes: [],
          tags: [],
          isLoading: false,
          syncError: null,
        }),

      clearSyncError: () => set({ syncError: null }),

      createNote: (input) => {
        const safeTimestamp = Math.max(0, Math.round(input.timestampMs));
        const bucketStart = Math.floor(safeTimestamp / 1000) * 1000;
        const bucketEnd = bucketStart + 999;

        const existingBookmark = input.isBookmark
          ? get().notes.find(
              (n) =>
                n.trackId === input.trackId &&
                n.isBookmark &&
                n.timestampMs >= bucketStart &&
                n.timestampMs <= bucketEnd
            )
          : undefined;

        const now = new Date().toISOString();

        if (existingBookmark) {
          const mergedTags = Array.from(new Set([...existingBookmark.tagIds, ...input.tagIds]));
          const nextText = input.noteText.trim()
            ? input.noteText.trim()
            : existingBookmark.noteText;

          const updatedBookmark: MemoryNote = {
            ...existingBookmark,
            noteText: nextText,
            tagIds: mergedTags,
            updatedAt: now,
          };

          set((state) => ({
            notes: state.notes.map((n) =>
              n.id === existingBookmark.id ? updatedBookmark : n
            ),
            syncError: null,
          }));

          void apiClient
            .upsertMemoryNote({
              trackId: input.trackId,
              timestampMs: safeTimestamp,
              noteText: input.noteText.trim(),
              isBookmark: true,
              tagIds: input.tagIds,
            })
            .then((res) => {
              set((state) => ({
                notes: state.notes.map((n) =>
                  n.id === existingBookmark.id ? res.note : n
                ),
              }));
            })
            .catch(() => {
              // Retained locally when offline
            });

          return { note: updatedBookmark, deduplicated: true };
        }

        const tempId = `mem-${crypto.randomUUID().slice(0, 8)}`;
        const note: MemoryNote = {
          id: tempId,
          trackId: input.trackId,
          timestampMs: safeTimestamp,
          noteText: input.noteText.trim(),
          isBookmark: input.isBookmark,
          tagIds: Array.from(new Set(input.tagIds)),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          notes: [note, ...state.notes],
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .upsertMemoryNote({
              trackId: note.trackId,
              timestampMs: note.timestampMs,
              noteText: note.noteText,
              isBookmark: note.isBookmark,
              tagIds: note.tagIds,
            })
            .then((res) => {
              set((state) => ({
                notes: state.notes.map((n) => (n.id === tempId ? res.note : n)),
              }));
            })
            .catch(() => {
              set({ syncError: 'Could not save MemoryMix entry to database.' });
            });
        }

        return { note, deduplicated: false };
      },

      updateNote: (id, updates) => {
        const previous = get().notes;
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : n
          ),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .updateMemoryNote(id, updates)
            .then((serverNote) => {
              set((state) => ({
                notes: state.notes.map((n) => (n.id === id ? serverNote : n)),
              }));
            })
            .catch(() => {
              set({
                notes: previous,
                syncError: 'Could not update MemoryMix entry in database.',
              });
            });
        }
      },

      deleteNote: (id) => {
        const previous = get().notes;
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient.deleteMemoryNote(id).catch(() => {
            set({
              notes: previous,
              syncError: 'Could not delete MemoryMix entry from database.',
            });
          });
        }
      },

      createTag: (name, colorHex) => {
        const cleanName = name.trim();
        const existing = get().tags.find(
          (t) => t.name.toLowerCase() === cleanName.toLowerCase()
        );
        if (existing) return existing;

        const tempId = `tag-${crypto.randomUUID().slice(0, 8)}`;
        const tag: UserTag = {
          id: tempId,
          name: cleanName,
          colorHex,
        };

        set((state) => ({
          tags: [...state.tags, tag],
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient
            .createMemoryTag(cleanName, colorHex)
            .then((serverTag) => {
              set((state) => ({
                tags: state.tags.map((t) => (t.id === tempId ? serverTag : t)),
                notes: state.notes.map((n) => ({
                  ...n,
                  tagIds: n.tagIds.map((tid) => (tid === tempId ? serverTag.id : tid)),
                })),
              }));
            })
            .catch(() => {
              set({ syncError: 'Could not save tag to database.' });
            });
        }

        return tag;
      },

      deleteTag: (id) => {
        const previousTags = get().tags;
        const previousNotes = get().notes;
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          notes: state.notes.map((n) => ({
            ...n,
            tagIds: n.tagIds.filter((tid) => tid !== id),
          })),
          syncError: null,
        }));

        if (useAuthStore.getState().accessToken) {
          void apiClient.deleteMemoryTag(id).catch(() => {
            set({
              tags: previousTags,
              notes: previousNotes,
              syncError: 'Could not delete tag from database.',
            });
          });
        }
      },

      getNotesForTrack: (trackId) => {
        return get()
          .notes.filter((n) => n.trackId === trackId)
          .sort((a, b) => a.timestampMs - b.timestampMs);
      },
    }),
    {
      name: 'soundsphere-memory-v2',
      partialize: (state) => ({
        ownerId: state.ownerId,
        notes: state.notes,
        tags: state.tags,
      }),
    }
  )
);
