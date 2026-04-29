'use client'

import { ReactNode, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useBoardStore } from '@/stores/board'
import { useClusterStore } from '@/stores/cluster'
import { useDesignStore } from '@/stores/design'
import { useProcessGraphStore } from '@/stores/process-graph'
import { useVoteStore } from '@/stores/vote'
import { useWorkshopStore } from '@/stores/workshop'
import type { Note } from '@/types/note'
import type { Vote } from '@/types/vote'
import type { Participant, Workshop } from '@/types/workshop'

export function WorkshopRealtimeProvider({
  workshop,
  participants,
  currentParticipant,
  children,
}: {
  workshop: Workshop
  participants: Participant[]
  currentParticipant: Participant
  children: ReactNode
}) {
  const setWorkshop = useWorkshopStore((state) => state.setWorkshop)
  const setParticipants = useWorkshopStore((state) => state.setParticipants)
  const setCurrentParticipant = useWorkshopStore((state) => state.setCurrentParticipant)
  const updateStage = useWorkshopStore((state) => state.updateStage)
  const refetchWorkshop = useWorkshopStore((state) => state.refetchAll)
  const refetchGraph = useProcessGraphStore((state) => state.refetchAll)
  const syncNoteFromRealtime = useBoardStore((state) => state.syncFromRealtime)
  const refetchNotes = useBoardStore((state) => state.refetchAll)
  const refetchClusters = useClusterStore((state) => state.refetchAll)
  const syncVoteFromRealtime = useVoteStore((state) => state.syncFromRealtime)
  const refetchVotes = useVoteStore((state) => state.refetchAll)
  const refetchDesign = useDesignStore((state) => state.refetchAll)
  const bumpReactionRevision = useDesignStore((state) => state.bumpReactionRevision)

  useEffect(() => {
    setWorkshop(workshop)
    setParticipants(participants)
    setCurrentParticipant(currentParticipant)
  }, [currentParticipant, participants, setCurrentParticipant, setParticipants, setWorkshop, workshop])

  useEffect(() => {
    const supabase = createBrowserClient()
    let reconnectFailures = 0

    const refreshAll = () => {
      // Random jitter (0-2s) to prevent thundering herd when all clients react simultaneously
      const jitter = Math.random() * 2000
      setTimeout(() => {
        void refetchWorkshop(workshop.id)
        void refetchGraph(workshop.id, currentParticipant.id)
        void refetchNotes(workshop.id)
        void refetchClusters(workshop.id)
        void refetchVotes(workshop.id)
        void refetchDesign(workshop.id)
      }, jitter)
    }

    const workshopChannel = supabase
      .channel(`workshop:${workshop.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workshops', filter: `id=eq.${workshop.id}` },
        (payload) => {
          const nextStage = payload.new.current_stage as Workshop['current_stage']
          updateStage(nextStage)
          refreshAll()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          reconnectFailures = 0
          refreshAll()
        }
        if (status === 'CHANNEL_ERROR') {
          reconnectFailures += 1
          if (reconnectFailures >= 3) {
            console.warn('workshop realtime channel is unstable')
          }
        }
      })

    const graphTables = ['process_steps', 'process_edges', 'process_lanes', 'editing_locks'] as const
    let graphDebounceTimer: ReturnType<typeof setTimeout> | undefined
    const graphHandler = () => {
      clearTimeout(graphDebounceTimer)
      graphDebounceTimer = setTimeout(() => {
        void refetchGraph(workshop.id, currentParticipant.id)
      }, 500)
    }
    const graphChannel = supabase.channel(`graph:${workshop.id}`)
    for (const table of graphTables) {
      graphChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `workshop_id=eq.${workshop.id}` },
        graphHandler,
      )
    }
    graphChannel.subscribe()

    const notesChannel = supabase
      .channel(`notes:${workshop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `workshop_id=eq.${workshop.id}` },
        (payload) => {
          const notePayload = payload.eventType === 'DELETE' ? payload.old : payload.new
          syncNoteFromRealtime(payload.eventType, notePayload as Note)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refetchNotes(workshop.id)
        }
      })

    const clustersChannel = supabase
      .channel(`clusters:${workshop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clusters', filter: `workshop_id=eq.${workshop.id}` },
        () => {
          void refetchClusters(workshop.id)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refetchClusters(workshop.id)
        }
      })

    const votesChannel = supabase
      .channel(`votes:${workshop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `workshop_id=eq.${workshop.id}` },
        (payload) => {
          const votePayload = payload.eventType === 'DELETE' ? payload.old : payload.new
          syncVoteFromRealtime(payload.eventType, votePayload as Vote)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refetchVotes(workshop.id)
        }
      })

    const designTables = ['ax_tasks', 'design_artifacts', 'prds', 'ax_reports'] as const
    const designChannel = supabase.channel(`design:${workshop.id}`)
    for (const table of designTables) {
      designChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `workshop_id=eq.${workshop.id}` },
        () => {
          void refetchDesign(workshop.id)
        },
      )
    }
    designChannel.subscribe()

    const reactionsChannel = supabase
      .channel(`reactions:${workshop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_reactions', filter: `workshop_id=eq.${workshop.id}` },
        () => {
          bumpReactionRevision()
        },
      )
      .subscribe()

    const presenceChannel = supabase.channel(`presence:${workshop.id}`, {
      config: { presence: { key: currentParticipant.id } },
    })
    presenceChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void presenceChannel.track({
          participant_id: currentParticipant.id,
          display_name: currentParticipant.display_name,
          is_editing: false,
        })
      }
    })

    return () => {
      clearTimeout(graphDebounceTimer)
      void supabase.removeChannel(workshopChannel)
      void supabase.removeChannel(graphChannel)
      void supabase.removeChannel(notesChannel)
      void supabase.removeChannel(clustersChannel)
      void supabase.removeChannel(votesChannel)
      void supabase.removeChannel(designChannel)
      void supabase.removeChannel(reactionsChannel)
      void supabase.removeChannel(presenceChannel)
    }
  }, [
    currentParticipant,
    bumpReactionRevision,
    refetchGraph,
    refetchClusters,
    refetchDesign,
    refetchNotes,
    refetchVotes,
    refetchWorkshop,
    syncVoteFromRealtime,
    syncNoteFromRealtime,
    updateStage,
    workshop.id,
  ])

  return children
}
