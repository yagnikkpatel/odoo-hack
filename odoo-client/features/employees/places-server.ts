import 'server-only'

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'
import { authError, authJson, checkSameOrigin, readAuthBody, readVerifiedUser } from '@/features/auth/auth-server'
import { employeeAccess } from '@/features/auth/permissions'
import { isRecord } from '@/features/auth/auth-validation'

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const placePattern = /^[A-Za-z0-9_-]{1,255}$/
const requests = new Map<string, { count: number; until: number }>()

function allowRequest(userId: string) {
  const now = Date.now()
  for (const [id, entry] of requests) if (entry.until <= now) requests.delete(id)
  const entry = requests.get(userId)
  if (entry) return ++entry.count <= 60
  if (requests.size >= 1000) return false
  requests.set(userId, { count: 1, until: now + 60_000 })
  return true
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function handlePlacesRequest(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    const user = token ? await readVerifiedUser(token) : null
    if (!user) return authError('Sign in to search office locations.', 401)
    if (!employeeAccess(user).canUpdate) return authError('Your role cannot edit employee locations.', 403)
    const body = await readAuthBody(request)
    if (!isRecord(body)) return authError('Provide a valid location search.', 400)
    const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
    if (body.action === 'status') return authJson({ success: true, data: { configured: Boolean(key) } })
    if (body.action !== 'autocomplete' && body.action !== 'details') return authError('Unsupported location request.', 400)
    if (typeof body.sessionToken !== 'string' || !tokenPattern.test(body.sessionToken)) return authError('Start a new location search.', 400)
    if (body.action === 'autocomplete' && (typeof body.input !== 'string' || body.input.trim().length < 2 || body.input.length > 200)) return authError('Enter between 2 and 200 characters.', 400)
    if (body.action === 'details' && (typeof body.placeId !== 'string' || !placePattern.test(body.placeId))) return authError('Choose a valid suggested location.', 400)
    if (!key) return authError('Location search is unavailable. Enter coordinates manually.', 503)
    if (!allowRequest(user.id)) return authError('Too many location searches. Wait a minute or enter coordinates manually.', 429)

    const autocomplete = body.action === 'autocomplete'
    const url = autocomplete ? 'https://places.googleapis.com/v1/places:autocomplete'
      : `https://places.googleapis.com/v1/places/${encodeURIComponent(String(body.placeId))}?sessionToken=${encodeURIComponent(body.sessionToken)}`
    const response = await fetch(url, {
      method: autocomplete ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': autocomplete
          ? 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text'
          : 'id,formattedAddress,location,attributions',
      },
      ...(autocomplete ? { body: JSON.stringify({ input: String(body.input).trim(), sessionToken: body.sessionToken, includedRegionCodes: ['in'], languageCode: 'en' }) } : {}),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return authError('Location search is unavailable. Try again or enter coordinates manually.', response.status === 429 ? 429 : 502)
    const data: unknown = await response.json()
    if (!isRecord(data)) throw new Error('Invalid place response')
    if (autocomplete) {
      if (data.suggestions !== undefined && !Array.isArray(data.suggestions)) throw new Error('Invalid predictions')
      const suggestions = (data.suggestions ?? []).flatMap((item: unknown) => {
        if (!isRecord(item) || !isRecord(item.placePrediction)) return []
        const prediction = item.placePrediction
        const format = isRecord(prediction.structuredFormat) ? prediction.structuredFormat : {}
        const mainText = isRecord(format.mainText) ? text(format.mainText.text) : isRecord(prediction.text) ? text(prediction.text.text) : ''
        if (!mainText || typeof prediction.placeId !== 'string' || !placePattern.test(prediction.placeId)) return []
        return [{ placeId: prediction.placeId, mainText, secondaryText: isRecord(format.secondaryText) ? text(format.secondaryText.text) : '' }]
      }).slice(0, 5)
      return authJson({ success: true, data: { suggestions } })
    }
    const location = isRecord(data.location) ? data.location : {}
    if (data.id !== body.placeId || typeof location.latitude !== 'number' || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
        typeof location.longitude !== 'number' || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180) {
      return authError('This place has no usable coordinates. Choose another result or enter them manually.', 422)
    }
    const attributions = Array.isArray(data.attributions) ? data.attributions.flatMap((item: unknown) =>
      isRecord(item) && text(item.provider) && /^https:\/\//.test(text(item.providerUri))
        ? [{ provider: text(item.provider), providerUri: text(item.providerUri) }] : []) : []
    return authJson({ success: true, data: { latitude: location.latitude, longitude: location.longitude, formattedAddress: text(data.formattedAddress), attributions } })
  } catch {
    return authError('Location search is unavailable. Try again or enter coordinates manually.', 503)
  }
}
