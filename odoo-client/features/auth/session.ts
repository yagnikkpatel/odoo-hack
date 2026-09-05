import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE_NAME } from './auth-constants'
import { readVerifiedUser } from './auth-server'
import type { SessionUser } from './auth-types'

export type { SessionUser } from './auth-types'
export { AuthServiceUnavailableError } from './auth-server'

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return token ? readVerifiedUser(token) : null
})

export const verifySession = cache(async (): Promise<SessionUser> => {
  const user = await getSession()
  if (!user) redirect('/login')
  return user
})
