'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BoardToolbar, type ProcessOption } from './BoardToolbar'
import { WhiteboardCanvas } from './WhiteboardCanvas'
import { useBoardStore } from '@/stores/board'
import { useProcessGraphStore } from '@/stores/process-graph'
import { useWorkshopStore } from '@/stores/workshop'
import type { Note, NoteColor } from '@/types/note'
import type { Participant } from '@/types/workshop'

const RETRYABLE_DELAY_MS = [1000, 2000, 4000] as const

export function Board({
  workshopId,
  currentParticipant,
  readOnly,
}: {
  workshopId: string
  currentParticipant: Participant
  readOnly: boolean
}) {
  const notes = useBoardStore((state) => state.notes)
  const participants = useWorkshopStore((state) => state.participants)
  const refetchNotes = useBoardStore((state) => state.refetchAll)
  const markPending = useBoardStore((state) => state.markPending)
  const clearPending = useBoardStore((state) => state.clearPending)
  const addNote = useBoardStore((state) => state.addNote)
  const updateNote = useBoardStore((state) => state.updateNote)
  const removeNote = useBoardStore((state) => state.removeNote)
  const processNodes = useProcessGraphStore((state) => state.nodes)
  const [selectedColor, setSelectedColor] = useState<NoteColor>('yellow')
  const [selectedProcessStepId, setSelectedProcessStepId] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const processOptions = useMemo<ProcessOption[]>(
    () =>
      processNodes.map((node) => ({
        id: node.id,
        label: typeof node.data?.label === 'string' ? node.data.label : node.id,
      })),
    [processNodes],
  )

  useEffect(() => {
    void refetchNotes(workshopId)
  }, [refetchNotes, workshopId])

  async function handleAddNote() {
    if (readOnly || notes.length >= 200) {
      return
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const nextNote: Note = {
      id,
      workshop_id: workshopId,
      participant_id: currentParticipant.id,
      cluster_id: null,
      process_step_id: selectedProcessStepId || null,
      content: '새 아이디어',
      color: selectedColor,
      position_x: 72 + (notes.length % 5) * 38,
      position_y: 72 + Math.floor(notes.length / 5) * 38,
      created_at: now,
      updated_at: now,
    }

    setIsCreating(true)
    markPending(id)
    addNote(nextNote)

    const saved = await syncNoteToDb<Note>('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        workshop_id: workshopId,
        content: nextNote.content,
        color: nextNote.color,
        position_x: nextNote.position_x,
        position_y: nextNote.position_y,
        process_step_id: nextNote.process_step_id,
      }),
    })

    clearPending(id)
    setIsCreating(false)

    if (!saved) {
      removeNote(id)
      toast.error('포스트잇 저장에 실패했습니다.')
      return
    }

    addNote(saved)
  }

  async function handlePatchNote(id: string, data: Partial<Note>) {
    if (readOnly) {
      return
    }

    const previous = useBoardStore.getState().notes.find((note) => note.id === id)
    if (!previous) {
      return
    }

    markPending(id)
    updateNote(id, {
      ...data,
      updated_at: new Date().toISOString(),
    })

    const saved = await syncNoteToDb<Note>(`/api/notes/${id}?workshop_id=${workshopId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(stripPatchPayload(data)),
    })

    clearPending(id)

    if (!saved) {
      updateNote(id, previous)
      toast.error('포스트잇 저장에 실패했습니다. 다음 수정 시 재시도됩니다.')
      return
    }

    addNote(saved)
  }

  async function handleDeleteNote(id: string) {
    if (readOnly) {
      return
    }

    const previous = useBoardStore.getState().notes.find((note) => note.id === id)
    if (!previous) {
      return
    }

    markPending(id)
    removeNote(id)

    const deleted = await syncNoteToDb<{ success: boolean }>(
      `/api/notes/${id}?workshop_id=${workshopId}`,
      {
        method: 'DELETE',
      },
    )

    clearPending(id)

    if (!deleted) {
      addNote(previous)
      toast.error('포스트잇 삭제에 실패했습니다.')
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950">
      <BoardToolbar
        selectedColor={selectedColor}
        selectedProcessStepId={selectedProcessStepId}
        processOptions={processOptions}
        noteCount={notes.length}
        readOnly={readOnly}
        isCreating={isCreating}
        onColorChange={setSelectedColor}
        onProcessStepChange={setSelectedProcessStepId}
        onAddNote={handleAddNote}
      />
      <WhiteboardCanvas
        workshopId={workshopId}
        notes={notes}
        participants={participants}
        currentParticipantId={currentParticipant.id}
        isFacilitator={currentParticipant.is_facilitator}
        processOptions={processOptions}
        readOnly={readOnly}
        onPatchNote={handlePatchNote}
        onDeleteNote={handleDeleteNote}
      />
    </main>
  )
}

async function syncNoteToDb<T>(url: string, init: RequestInit, retries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, init)

      if (response.ok) {
        const payload = await response.json()
        return payload.data as T
      }

      if ([400, 403, 409].includes(response.status)) {
        return null
      }
    } catch {
      // Network failures are retried with exponential backoff.
    }

    if (attempt < retries - 1) {
      await wait(RETRYABLE_DELAY_MS[attempt] ?? RETRYABLE_DELAY_MS[2])
    }
  }

  return null
}

function stripPatchPayload(data: Partial<Note>) {
  return {
    ...(data.content !== undefined ? { content: data.content } : {}),
    ...(data.color !== undefined ? { color: data.color } : {}),
    ...(data.position_x !== undefined ? { position_x: data.position_x } : {}),
    ...(data.position_y !== undefined ? { position_y: data.position_y } : {}),
    ...(data.process_step_id !== undefined ? { process_step_id: data.process_step_id } : {}),
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}
