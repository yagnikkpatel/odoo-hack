import { ApiError, apiRequest } from '@/lib/api-client'
import { isRecord } from '@/features/auth/auth-validation'
import { parseCreatedUser } from './validation'
import type { CreateUserInput } from './types'

export async function createUser(input: CreateUserInput) {
  const result: unknown = await apiRequest('/api/users', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(input)
  })
  if (!isRecord(result) || result.success !== true) {
    throw new ApiError('The account service returned an invalid response.', 502)
  }
  const user = parseCreatedUser(result.data)
  if (!user) {
    throw new ApiError('The account may have been created. Check existing accounts before trying again.', 502)
  }
  return user
}
