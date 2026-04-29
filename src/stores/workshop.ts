import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { STAGE_ORDER, getStageIndex } from '@/lib/workshop/stage'
import type { Participant, Workshop, WorkshopStage } from '@/types/workshop'

interface WorkshopStore {
  workshop: Workshop | null
  participants: Participant[]
  currentParticipant: Participant | null
  isFacilitator: boolean
  viewingStage: WorkshopStage | null
  setWorkshop(workshop: Workshop): void
  setParticipants(participants: Participant[]): void
  setCurrentParticipant(participant: Participant): void
  updateStage(stage: WorkshopStage): void
  setViewingStage(stage: WorkshopStage): void
  addParticipant(participant: Participant): void
  refetchAll(workshopId: string): Promise<void>
}

export const useWorkshopStore = create<WorkshopStore>()(
  devtools(
    (set, get) => ({
      workshop: null,
      participants: [],
      currentParticipant: null,
      isFacilitator: false,
      viewingStage: null,

      setWorkshop: (workshop) =>
        set({
          workshop,
          viewingStage: workshop.current_stage,
        }),

      setParticipants: (participants) => set({ participants }),

      setCurrentParticipant: (participant) =>
        set({
          currentParticipant: participant,
          isFacilitator: participant.is_facilitator,
        }),

      updateStage: (stage) =>
        set((state) => ({
          workshop: state.workshop ? { ...state.workshop, current_stage: stage } : null,
          viewingStage: stage,
        })),

      setViewingStage: (stage) => {
        const workshop = get().workshop
        if (!workshop) {
          return
        }

        if (getStageIndex(stage) <= getStageIndex(workshop.current_stage)) {
          set({ viewingStage: stage })
        }
      },

      addParticipant: (participant) =>
        set((state) => ({
          participants: state.participants.some((existing) => existing.id === participant.id)
            ? state.participants
            : [...state.participants, participant],
        })),

      refetchAll: async (workshopId) => {
        const response = await fetch(`/api/workshops/${workshopId}`)
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        const workshop = payload.data.workshop as Workshop
        const participants = payload.data.participants as Participant[]
        const currentParticipant = get().currentParticipant

        const updatedParticipant = currentParticipant
          ? participants.find((participant) => participant.id === currentParticipant.id) ??
            currentParticipant
          : null

        set({
          workshop,
          participants,
          viewingStage: get().viewingStage ?? workshop.current_stage,
          currentParticipant: updatedParticipant,
          isFacilitator: updatedParticipant?.is_facilitator ?? false,
        })
      },
    }),
    { name: 'workshop-store' },
  ),
)

export { STAGE_ORDER }
