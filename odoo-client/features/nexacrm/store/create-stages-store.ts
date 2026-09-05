// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'
import type { StoreApi, UseBoundStore } from '@/features/nexacrm/adapters/native-store'

// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'

export type StagesStore = {
  stages: string[]
  labels: Record<string, string>

  tones: Record<string, BadgeTone>

  cardOrder: string[]
  setStages: (stages: string[]) => void
  setCardOrder: (cardOrder: string[]) => void
  addStage: (label: string) => void
  renameStage: (stage: string, label: string) => void
  setStageTone: (stage: string, tone: BadgeTone) => void
  deleteStage: (stage: string) => void
  validateNewStage: (label: string) => string | undefined

  /** Move a column one place left or right - the Pipeline Editor's reorder controls. */
  moveStage: (stage: string, direction: -1 | 1) => void

  resetToSeed: () => void
}

/** What `createStagesStore` hands back, and the type every consumer of a stages store should take. */
export type StagesStoreHook = UseBoundStore<StoreApi<StagesStore>>

/** "In review" → `in_review`. The id a new column's records will carry as their status. */
const toId = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export type StagesSeed = {
  stages: readonly string[]
  labels: Record<string, string>
  tones: Record<string, BadgeTone>
}

export const useStageOptions = (store: StagesStoreHook): { label: string; value: string }[] => {
  const stages = store(state => state.stages)
  const labels = store(state => state.labels)

  return useMemo(() => stages.map(stage => ({ label: labels[stage] ?? stage, value: stage })), [stages, labels])
}

export const createStagesStore = (seed: StagesSeed): StagesStoreHook =>
  create<StagesStore>()((set, get) => ({
    stages: [...seed.stages],
    labels: { ...seed.labels },
    tones: { ...seed.tones },
    cardOrder: [],

    setStages: stages => set({ stages }),

    setCardOrder: cardOrder => set({ cardOrder }),

    addStage: label => {
      const id = toId(label)

      if (!id || get().stages.includes(id)) return

      set(state => ({
        stages: [...state.stages, id],
        labels: { ...state.labels, [id]: label.trim() },
        tones: { ...state.tones, [id]: 'neutral' }
      }))
    },

    renameStage: (stage, label) => set(state => ({ labels: { ...state.labels, [stage]: label.trim() } })),

    setStageTone: (stage, tone) => set(state => ({ tones: { ...state.tones, [stage]: tone } })),

    deleteStage: stage =>
      set(state => (state.stages.length <= 1 ? state : { stages: state.stages.filter(item => item !== stage) })),

    moveStage: (stage, direction) =>
      set(state => {
        const from = state.stages.indexOf(stage)
        const to = from + direction

        if (from === -1 || to < 0 || to >= state.stages.length) return state

        const stages = [...state.stages]

        ;[stages[from], stages[to]] = [stages[to], stages[from]]

        return { stages }
      }),

    validateNewStage: label => {
      const id = toId(label)

      if (!id) return 'Enter a stage name.'
      if (get().stages.includes(id)) return 'That stage already exists.'

      return undefined
    },

    resetToSeed: () =>
      set({
        stages: [...seed.stages],
        labels: { ...seed.labels },
        tones: { ...seed.tones },
        cardOrder: []
      })
  }))
