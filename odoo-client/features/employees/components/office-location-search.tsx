'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'

type Suggestion = { placeId: string; mainText: string; secondaryText: string }
type Place = { latitude: number; longitude: number; formattedAddress: string; attributions: { provider: string; providerUri: string }[] }

async function request<T>(body: object, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/employees/places', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  })
  const result = await response.json()
  if (!response.ok || result.success !== true) throw new Error(result.message || 'Location search is unavailable. Enter coordinates manually.')
  return result.data as T
}

export default function OfficeLocationSearch({ onSelect, onFallback, onPendingChange }: {
  onSelect: (place: Place & { name: string }) => void
  onFallback: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const id = useId()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Place | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [active, setActive] = useState(-1)
  const sessionToken = useRef<string | null>(null)
  const version = useRef(0)
  const detailsRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    request<{ configured: boolean }>({ action: 'status' }, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setConfigured(data.configured)
      if (!data.configured) onFallback()
    }).catch(() => {
      if (!controller.signal.aborted) { setConfigured(false); onFallback() }
    })
    return () => { controller.abort(); detailsRequest.current?.abort() }
  }, [onFallback])

  useEffect(() => {
    if (!configured || query.trim().length < 2) return
    const controller = new AbortController()
    const current = version.current
    const timer = setTimeout(() => {
      sessionToken.current ??= crypto.randomUUID()
      request<{ suggestions: Suggestion[] }>({ action: 'autocomplete', input: query.trim(), sessionToken: sessionToken.current }, controller.signal).then(data => {
        if (controller.signal.aborted || current !== version.current) return
        setSuggestions(data.suggestions); setSearched(true)
      }).catch(cause => {
        if (controller.signal.aborted || current !== version.current) return
        setError(cause instanceof Error ? cause.message : 'Search unavailable. Enter coordinates manually.')
        onPendingChange(false); onFallback()
      }).finally(() => {
        if (!controller.signal.aborted && current === version.current) setLoading(false)
      })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, configured, onFallback, onPendingChange])

  function manualEntry() {
    ++version.current; detailsRequest.current?.abort(); sessionToken.current = null
    setQuery(''); setSuggestions([]); setActive(-1); setSelected(null); setLoading(false); setSearched(false); setError(null)
    onPendingChange(false); onFallback()
  }

  async function select(suggestion: Suggestion) {
    if (!sessionToken.current) return
    const token = sessionToken.current
    sessionToken.current = null // Details ends this session, even if the response is lost.
    const current = ++version.current
    detailsRequest.current?.abort()
    const controller = new AbortController()
    detailsRequest.current = controller
    setQuery(''); setSuggestions([]); setActive(-1); setLoading(true); setError(null); setSearched(false)
    onPendingChange(true)
    try {
      const place = await request<Place>({ action: 'details', placeId: suggestion.placeId, sessionToken: token }, controller.signal)
      if (controller.signal.aborted || current !== version.current) return
      setSelected(place)
      onSelect({ ...place, name: suggestion.mainText })
      onPendingChange(false)
    } catch (cause) {
      if (controller.signal.aborted || current !== version.current) return
      setError(cause instanceof Error ? cause.message : 'Could not retrieve coordinates. Enter them manually.')
      onPendingChange(false); onFallback()
    } finally {
      if (!controller.signal.aborted && current === version.current) setLoading(false)
    }
  }

  return <div className="space-y-2">
    <Label htmlFor={id}>Search office or address</Label>
    <Input id={id} role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0}
      aria-controls={`${id}-results`} aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
      disabled={configured !== true} autoComplete="off" maxLength={200} placeholder="Start typing an address in India…" value={query}
      onChange={event => {
        const value = event.target.value
        ++version.current; detailsRequest.current?.abort()
        setQuery(value); setSuggestions([]); setSelected(null); setActive(-1); setSearched(false); setError(null)
        setLoading(value.trim().length >= 2); onPendingChange(Boolean(value.trim()))
        if (!value.trim()) sessionToken.current = null
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (suggestions.length) setActive(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length)
        } else if (event.key === 'Enter' && query) {
          event.preventDefault()
          if (active >= 0 && suggestions[active]) void select(suggestions[active])
        } else if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); manualEntry() }
      }} />
    {configured === false && <p className="text-xs text-muted-foreground">Location search is unavailable. You can enter coordinates below.</p>}
    {loading && <p role="status" className="text-xs text-muted-foreground">Looking up location…</p>}
    {!!suggestions.length && <div className="overflow-hidden rounded-lg border bg-popover">
      <ul id={`${id}-results`} role="listbox" aria-label="Suggested office locations">
        {suggestions.map((suggestion, index) => <li key={suggestion.placeId} id={`${id}-option-${index}`} role="option" aria-selected={active === index}>
          <button type="button" className={`w-full px-3 py-2 text-left hover:bg-accent ${active === index ? 'bg-accent' : ''}`}
            onClick={() => void select(suggestion)}>
            <span className="block text-sm font-medium">{suggestion.mainText}</span>
            <span className="block text-xs text-muted-foreground">{suggestion.secondaryText}</span>
          </button>
        </li>)}
      </ul>
      <p translate="no" className="border-t px-3 py-1.5 text-right text-xs font-normal not-italic tracking-normal whitespace-nowrap text-[#5e5e5e] dark:text-white">Google Maps</p>
    </div>}
    {searched && !loading && !suggestions.length && <p className="text-xs text-muted-foreground">No places found. Try a more specific address or enter coordinates manually.</p>}
    {selected && <div role="status" className="rounded-lg border p-3 text-sm">
      <p>{selected.formattedAddress || 'Location selected'}</p>
      <p className="mt-1 text-xs text-muted-foreground">Coordinates filled. Save changes to update this employee.</p>
      <p translate="no" className="mt-2 text-xs font-normal not-italic tracking-normal whitespace-nowrap text-[#5e5e5e] dark:text-white">Google Maps</p>
      {selected.attributions.map(item => <a key={item.providerUri} href={item.providerUri} target="_blank" rel="noreferrer" className="block text-xs underline">{item.provider}</a>)}
    </div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {!!query && !error && !loading && <p className="text-xs text-muted-foreground">Choose a suggestion to fill coordinates, or use manual entry.</p>}
    <Button type="button" variant="ghost" size="sm" onClick={manualEntry}>Enter coordinates manually</Button>
  </div>
}
