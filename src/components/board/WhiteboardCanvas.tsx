'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import { StickyNoteShape } from './StickyNoteShape'
import type { ProcessOption } from './BoardToolbar'
import { createYjsProvider, destroyYjsProvider, type YjsProviderHandle } from '@/lib/yjs/provider'
import type { Note } from '@/types/note'
import type { Participant } from '@/types/workshop'

export function WhiteboardCanvas({
  workshopId,
  notes,
  participants,
  currentParticipantId,
  isFacilitator,
  processOptions,
  readOnly,
  onPatchNote,
  onDeleteNote,
}: {
  workshopId: string
  notes: Note[]
  participants: Participant[]
  currentParticipantId: string
  isFacilitator: boolean
  processOptions: ProcessOption[]
  readOnly: boolean
  onPatchNote(id: string, data: Partial<Note>): void
  onDeleteNote(id: string): void
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [yjsStatus, setYjsStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const participantNames = useMemo(
    () =>
      new Map(
        participants.map((participant) => [participant.id, participant.display_name] as const),
      ),
    [participants],
  )

  useEffect(() => {
    let disposed = false
    let handle: YjsProviderHandle | null = null

    void createYjsProvider(workshopId)
      .then((nextHandle) => {
        if (disposed) {
          destroyYjsProvider(nextHandle)
          return
        }

        handle = nextHandle
        setYjsStatus(nextHandle.provider.connected ? 'connected' : 'connecting')
        nextHandle.provider.on('status', () => {
          setYjsStatus(nextHandle.provider.connected ? 'connected' : 'connecting')
        })
      })
      .catch((providerError) => {
        console.warn('failed to initialize yjs provider', providerError)
        setYjsStatus('offline')
      })

    return () => {
      disposed = true
      if (handle) {
        destroyYjsProvider(handle)
      }
    }
  }, [workshopId])

  useEffect(() => {
    editor?.updateInstanceState({ isReadonly: readOnly })
  }, [editor, readOnly])

  const handleMount = useCallback(
    (mountedEditor: Editor) => {
      mountedEditor.updateInstanceState({ isReadonly: readOnly, isGridMode: true })
      mountedEditor.setCamera({ x: -80, y: -80, z: 1 })
      setEditor(mountedEditor)

      return () => setEditor(null)
    },
    [readOnly],
  )

  return (
    <div className="relative h-[calc(100vh-220px)] min-h-[520px] overflow-hidden bg-neutral-950">
      <Tldraw autoFocus={false} hideUi inferDarkMode onMount={handleMount} />
      <div className="pointer-events-none absolute inset-0">
        {notes.length === 0 ? (
          <div className="absolute left-6 top-6 rounded-md border border-dashed border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-neutral-300">
            첫 포스트잇을 추가해 아이디어 수집을 시작하세요.
          </div>
        ) : null}
        {notes.map((note) => {
          const isOwner = note.participant_id === currentParticipantId
          return (
            <StickyNoteShape
              key={note.id}
              note={note}
              participantName={participantNames.get(note.participant_id) ?? '참석자'}
              processOptions={processOptions}
              canEdit={isOwner}
              canDelete={isOwner || isFacilitator}
              readOnly={readOnly}
              onPatch={onPatchNote}
              onDelete={onDeleteNote}
            />
          )
        })}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-neutral-950/80 px-2 py-1 text-xs text-neutral-400">
        Yjs {yjsStatus}
      </div>
    </div>
  )
}
