'use client'

import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

type Options = { history?: 'push' | 'replace'; shallow?: boolean; clearOnDefault?: boolean }
type Parser<T> = {
  parse: (raw: string | null) => T
  defaultValue: T
  options: Options
  withDefault: (value: NonNullable<T>) => Parser<NonNullable<T>>
  withOptions: (options: Options) => Parser<T>
}

function parser<T>(parse: (raw: string | null) => T, defaultValue: T, options: Options = {}): Parser<T> {
  return {
    parse, defaultValue, options,
    withDefault: value => parser(raw => parse(raw) ?? value, value, options),
    withOptions: next => parser(parse, defaultValue, { ...options, ...next })
  }
}

export const parseAsString = parser<string | null>(raw => raw, null)
export const parseAsStringLiteral = <T extends string>(values: readonly T[]) =>
  parser<T | null>(raw => values.includes(raw as T) ? raw as T : null, null)

/** Native URL state for the template's view, filter and preview controls.
 * Preserve unrelated parameters and support Back/Forward without server round trips.
 */
export function useQueryState<T extends string | null>(key: string, config: Parser<T>) {
  // Use the framework's URL snapshot on both server and client so a deep link
  // renders the correct view immediately, without flashing the cookie's default.
  const search = useSearchParams()
  const value = config.parse(search.get(key))
  const { parse, defaultValue, options: { history = 'replace', clearOnDefault = true } } = config
  const setValue = useCallback((update: T | null | ((current: T) => T | null)) => {
    const url = new URL(window.location.href)
    const next = typeof update === 'function' ? update(parse(url.searchParams.get(key))) : update
    if (next === null || (clearOnDefault && next === defaultValue)) url.searchParams.delete(key)
    else url.searchParams.set(key, next)
    if (url.href !== window.location.href) {
      // Next.js copies its own history metadata and updates route/search hooks.
      // Passing its private state back would bypass that integration.
      window.history[history === 'push' ? 'pushState' : 'replaceState'](null, '', url)
    }
    return Promise.resolve(url.searchParams)
  }, [key, parse, defaultValue, history, clearOnDefault])
  return [value, setValue] as const
}
