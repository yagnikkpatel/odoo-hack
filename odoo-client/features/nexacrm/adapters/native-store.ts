'use client'

import { useSyncExternalStore } from 'react'

type Update<T> = T | Partial<T> | ((state: T) => T | Partial<T>)
export type StoreApi<T> = {
  getState: () => T
  getInitialState: () => T
  setState: (update: Update<T>, replace?: boolean) => void
  subscribe: (listener: () => void) => () => void
}
type StateOf<S> = S extends { getState: () => infer T } ? T : never
export type UseBoundStore<S extends { getState: () => unknown }> = S & {
  (): StateOf<S>
  <Selected>(selector: (state: StateOf<S>) => Selected): Selected
}
type Initializer<T> = (set: StoreApi<T>['setState'], get: StoreApi<T>['getState']) => T

/** In-memory client state using React's native external-store API, never persisted.
 * Server snapshots remain the immutable initial state; client providers initialize records.
 * This narrow adapter keeps the warehouse's actions and JSX intact without Zustand.
 */
function buildStore<T>(initialize: Initializer<T>): UseBoundStore<StoreApi<T>> {
  const listeners = new Set<() => void>()
  let state: T
  const api: StoreApi<T> = {
    getState: () => state,
    getInitialState: () => initialState,
    setState: (update, replace = false) => {
      const next = typeof update === 'function' ? (update as (state: T) => T | Partial<T>)(state) : update
      if (Object.is(next, state)) return
      state = replace ? (next as T) : Object.assign({}, state, next)
      listeners.forEach(listener => listener())
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  const initialState = initialize(api.setState, api.getState)
  state = initialState

  function useStore<Selected = T>(selector?: (state: T) => Selected): T | Selected {
    // Subscribe to the stable state object before selecting, so derived arrays do not
    // cause the uncached-snapshot loop that selecting inside getSnapshot would cause.
    const snapshot = useSyncExternalStore(api.subscribe, api.getState, api.getInitialState)
    return selector ? selector(snapshot) : snapshot
  }
  return Object.assign(useStore, api) as UseBoundStore<StoreApi<T>>
}

export function create<T>(): (initialize: Initializer<T>) => UseBoundStore<StoreApi<T>>
export function create<T>(initialize: Initializer<T>): UseBoundStore<StoreApi<T>>
export function create<T>(initialize?: Initializer<T>) {
  return initialize ? buildStore(initialize) : buildStore<T>
}
