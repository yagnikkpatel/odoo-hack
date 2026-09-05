// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

type CurrentActorStore = {
  actorId?: string
  setActorId: (actorId?: string) => void
}

export const useCurrentActorStore = create<CurrentActorStore>(set => ({
  actorId: undefined,
  setActorId: actorId => set({ actorId })
}))

/** Read the acting user id at mutation time. For use inside store actions, not components. */
export const getActorId = () => useCurrentActorStore.getState().actorId
