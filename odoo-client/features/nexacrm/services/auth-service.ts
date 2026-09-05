import 'server-only'

// Type Imports
import type { User } from '@/features/nexacrm/types/apps/user-types'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/auth'

export const getCurrentUser = async (): Promise<User> => {
  return db[0]
}

export const getUsers = async (): Promise<User[]> => {
  return db
}
