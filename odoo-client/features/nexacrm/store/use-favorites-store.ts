// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

type FavoritesStore = {
  keys: string[]
  toggle: (entityType: ParentEntityType, entityId: string) => void
  isFavorite: (entityType: ParentEntityType, entityId: string) => boolean
}

const keyFor = (entityType: ParentEntityType, entityId: string) => `${entityType}:${entityId}`

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  keys: [],

  toggle: (entityType, entityId) =>
    set(state => {
      const key = keyFor(entityType, entityId)

      return { keys: state.keys.includes(key) ? state.keys.filter(item => item !== key) : [...state.keys, key] }
    }),

  isFavorite: (entityType, entityId) => get().keys.includes(keyFor(entityType, entityId))
}))

/** Subscribes to changes for one record, so a star re-renders when toggled. */
export const useIsFavorite = (entityType: ParentEntityType, entityId: string) =>
  useFavoritesStore(state => state.keys.includes(keyFor(entityType, entityId)))
