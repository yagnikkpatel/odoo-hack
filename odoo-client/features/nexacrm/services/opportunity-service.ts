import 'server-only'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/opportunities'

const minutesAgoToIso = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const minutesFromNowToIso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

const assertCoherent = (seed: (typeof db)[number]) => {
  const fail = (message: string): never => {
    throw new Error(
      `Incoherent opportunity seed "${seed.id}": ${message}. See the axes in fake-db/apps/opportunities.ts.`
    )
  }

  const { stagePath } = seed

  if (stagePath.length === 0) fail('empty stagePath')

  if (stagePath[0][1] !== seed.createdMinutesAgo) {
    fail(`stagePath starts at ${stagePath[0][1]} but createdMinutesAgo is ${seed.createdMinutesAgo}`)
  }

  for (let index = 1; index < stagePath.length; index++) {
    if (stagePath[index][1] >= stagePath[index - 1][1]) {
      fail(
        `stagePath is not strictly descending at index ${index} (${stagePath[index - 1][1]} → ${stagePath[index][1]})`
      )
    }
  }

  const lastStage = stagePath[stagePath.length - 1][0]

  if (lastStage !== seed.stage) fail(`stagePath ends at "${lastStage}" but stage is "${seed.stage}"`)

  if (seed.outcome === 'open') {
    if (seed.closedMinutesAgo != null) fail('is open but carries closedMinutesAgo')
  } else {
    if (seed.closedMinutesAgo == null) fail(`is "${seed.outcome}" but has no closedMinutesAgo`)
    if (seed.closeInMinutes >= 0)
      fail(`is "${seed.outcome}" but closeInMinutes ${seed.closeInMinutes} is not in the past`)

    if (seed.closedMinutesAgo! >= stagePath[stagePath.length - 1][1]) {
      fail(`closed (${seed.closedMinutesAgo}) before entering its final stage (${stagePath[stagePath.length - 1][1]})`)
    }
  }

  if (seed.closeInMinutes + seed.createdMinutesAgo < 0) {
    fail(`closeDate precedes createdAt (closeInMinutes ${seed.closeInMinutes}, created ${seed.createdMinutesAgo} ago)`)
  }
}

const toOpportunity = (seed: (typeof db)[number]): Opportunity => {
  assertCoherent(seed)

  const { createdMinutesAgo, updatedMinutesAgo, closeInMinutes, closedMinutesAgo, stagePath, ...opportunity } = seed

  return {
    ...opportunity,
    closeDate: minutesFromNowToIso(closeInMinutes),
    ...(closedMinutesAgo == null ? {} : { closedAt: minutesAgoToIso(closedMinutesAgo) }),
    stageHistory: stagePath.map(([stage, enteredMinutesAgo]) => ({
      stage,
      enteredAt: minutesAgoToIso(enteredMinutesAgo)
    })),
    createdAt: minutesAgoToIso(createdMinutesAgo),
    updatedAt: minutesAgoToIso(updatedMinutesAgo)
  }
}

export const getOpportunities = async (): Promise<Opportunity[]> => {
  return db.map(toOpportunity)
}

export const getOpportunityById = async (id: string): Promise<Opportunity | undefined> => {
  const seed = db.find(opportunity => opportunity.id === id)

  return seed && toOpportunity(seed)
}
