import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Note } from '@/types/note'

type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | string

interface BoardStore {
  notes: Note[]
  pendingNoteIds: Set<string>
  setNotes(notes: Note[]): void
  syncFromRealtime(eventType: RealtimeEventType, note: Note): void
  markPending(id: string): void
  clearPending(id: string): void
  addNote(note: Note): void
  updateNote(id: string, data: Partial<Note>): void
  removeNote(id: string): void
  refetchAll(workshopId: string): Promise<void>
}

export const useBoardStore = create<BoardStore>()(
  devtools(
    (set, get) => ({
      notes: [],
      pendingNoteIds: new Set<string>(),

      setNotes: (notes) =>
        set({
          notes: sortNotes(notes),
        }),

      syncFromRealtime: (eventType, note) => {
        if (get().pendingNoteIds.has(note.id)) {
          return
        }

        if (eventType === 'DELETE') {
          get().removeNote(note.id)
          return
        }

        if (eventType === 'INSERT') {
          get().addNote(note)
          return
        }

        if (eventType === 'UPDATE') {
          set((state) => {
            const exists = state.notes.some((existing) => existing.id === note.id)
            return {
              notes: sortNotes(
                exists
                  ? state.notes.map((existing) => (existing.id === note.id ? note : existing))
                  : [...state.notes, note],
              ),
            }
          })
        }
      },

      markPending: (id) =>
        set((state) => ({
          pendingNoteIds: new Set(state.pendingNoteIds).add(id),
        })),

      clearPending: (id) =>
        set((state) => {
          const next = new Set(state.pendingNoteIds)
          next.delete(id)
          return { pendingNoteIds: next }
        }),

      addNote: (note) =>
        set((state) => {
          const exists = state.notes.some((existing) => existing.id === note.id)
          return {
            notes: sortNotes(
              exists
                ? state.notes.map((existing) => (existing.id === note.id ? note : existing))
                : [...state.notes, note],
            ),
          }
        }),

      updateNote: (id, data) =>
        set((state) => ({
          notes: sortNotes(
            state.notes.map((note) => (note.id === id ? { ...note, ...data } : note)),
          ),
        })),

      removeNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        })),

      refetchAll: async (workshopId) => {
        const response = await fetch(`/api/notes?workshop_id=${workshopId}`)
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        set({ notes: sortNotes(payload.data as Note[]) })
      },
    }),
    { name: 'board-store' },
  ),
)

function sortNotes(notes: Note[]) {
  return [...notes].sort((left, right) => left.created_at.localeCompare(right.created_at))
}
