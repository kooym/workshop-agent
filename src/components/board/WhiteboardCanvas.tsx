'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent, type PointerEvent } from 'react'
import { StickyNoteShape } from './StickyNoteShape'
import type { ProcessOption } from './BoardToolbar'
import { createYjsProvider, destroyYjsProvider, type YjsProviderHandle } from '@/lib/yjs/provider'
import type { Note } from '@/types/note'
import type { Participant } from '@/types/workshop'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_SENSITIVITY = 0.002

type Camera = { x: number; y: number; zoom: number }

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
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; camX: number; camY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Wheel zoom (pinch-to-zoom on trackpad)
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Pointer position relative to container
    const pointerX = e.clientX - rect.left
    const pointerY = e.clientY - rect.top

    setCamera((prev) => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * (1 + delta)))
      const ratio = nextZoom / prev.zoom

      // Zoom towards pointer
      return {
        x: pointerX - (pointerX - prev.x) * ratio,
        y: pointerY - (pointerY - prev.y) * ratio,
        zoom: nextZoom,
      }
    })
  }, [])

  // Middle-click or right-click pan
  const handleContainerPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    // Middle button (1) or right button (2) for panning
    if (e.button !== 1 && e.button !== 2) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsPanning(true)
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      camX: camera.x,
      camY: camera.y,
    }
  }, [camera.x, camera.y])

  const handleContainerPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    setCamera((prev) => ({
      ...prev,
      x: pan.camX + (e.clientX - pan.startX),
      y: pan.camY + (e.clientY - pan.startY),
    }))
  }, [])

  const handleContainerPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    panRef.current = null
    setIsPanning(false)
  }, [])

  // Prevent context menu on right-click pan
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative h-[calc(100vh-220px)] min-h-[520px] overflow-hidden bg-canvas-parchment ${isPanning ? 'cursor-grabbing' : ''}`}
      onWheel={handleWheel}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
      onContextMenu={handleContextMenu}
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, #525252 1px, transparent 1px)',
          backgroundSize: `${24 * camera.zoom}px ${24 * camera.zoom}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
      />

      {/* Transform layer — notes live inside so they pan/zoom together */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        {notes.length === 0 ? (
          <div className="absolute left-6 top-6 w-80 rounded-md border border-dashed border-hairline bg-white/80 px-4 py-3 text-sm text-ink-muted-80">
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

      {/* HUD overlay (does not transform) */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3">
        <span className="rounded bg-white/80 px-2 py-1 text-xs text-ink-muted-48">
          {Math.round(camera.zoom * 100)}%
        </span>
        <span className="rounded bg-white/80 px-2 py-1 text-xs text-ink-muted-48">
          Yjs {yjsStatus}
        </span>
      </div>
    </div>
  )
}
