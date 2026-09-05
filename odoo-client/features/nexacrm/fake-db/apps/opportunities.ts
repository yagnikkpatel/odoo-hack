// Type Imports
import type { Opportunity, OpportunitySource, OpportunityStage } from '@/features/nexacrm/types/apps/opportunity-types'

// Data Imports
import { scaleCompanies } from '@/features/nexacrm/fake-db/apps/companies'
import { scalePeople } from '@/features/nexacrm/fake-db/apps/people'
import type { PersonSeed } from '@/features/nexacrm/fake-db/apps/people'

/*
 * ! SEED AXES. A new or edited row must hold all seven. Axes 5-7 are asserted at load in
 * ! `opportunity-service.ts` and throw; 1-4 are NOT machine-checked and fail silently.
 * !
 * !   1. `pointOfContactId` is a person who works at this `companyId`, created before this row.
 * !   2. The company's `status` matches its deals: won -> customer, lost -> churned/at_risk.
 * !   3. Every stage carries open pipeline, so no board column and no chart band is empty.
 * !   4. The opportunity is created AFTER its company.
 * !   5. `outcome !== 'open'` <=> `closedMinutesAgo` set, below the last `stagePath` offset.
 * !   6. `stagePath` offsets strictly descending; first === `createdMinutesAgo`; last stage === `stage`.
 * !   7. `closeDate` is never before `createdAt`.
 * !
 * ! A malformed `stagePath` does not crash - it draws a plausible, WRONG funnel.
 */
export type OpportunityStagePath = [stage: OpportunityStage, enteredMinutesAgo: number][]

export type OpportunitySeed = Omit<
  Opportunity,
  'createdAt' | 'updatedAt' | 'closeDate' | 'closedAt' | 'stageHistory'
> & {
  createdMinutesAgo: number
  updatedMinutesAgo: number

  /** Signed: positive = closes in the future, negative = the date has already passed. */
  closeInMinutes: number

  /** Unsigned. Set iff `outcome !== 'open'` - axis 5. */
  closedMinutesAgo?: number

  /** Ascending in time = DESCENDING offsets - axis 6. */
  stagePath: OpportunityStagePath
}

const STAGE_ORDER = ['new', 'screening', 'meeting', 'proposal', 'customer'] as const

const STAGE_PROBABILITY: Record<(typeof STAGE_ORDER)[number], number> = {
  new: 10,
  screening: 25,
  meeting: 50,
  proposal: 75,
  customer: 90
}

const DEAL_NAMES = [
  'Platform licence',
  'Data migration',
  'Access review',
  'Analytics rollout',
  'Workspace expansion',
  'Integration project',
  'Support upgrade',
  'Compliance package',
  'Automation pilot',
  'Reporting suite',
  'API tier upgrade',
  'Onboarding programme',
  'Infrastructure renewal',
  'Team seats expansion',
  'Managed services',
  'Storage add-on',
  'Identity rollout',
  'Workflow modernisation',
  'Insights package',
  'Enterprise agreement'
]

const AMOUNTS = [42000, 68000, 95000, 130000, 175000, 210000, 265000, 320000, 88000, 154000, 240000, 58000]

const WON_SOURCES = [
  ...Array<OpportunitySource>(7).fill('inbound'),
  ...Array<OpportunitySource>(4).fill('outbound'),
  ...Array<OpportunitySource>(6).fill('referral'),
  ...Array<OpportunitySource>(5).fill('event'),
  ...Array<OpportunitySource>(7).fill('partner')
]

const LOST_SOURCES = [
  ...Array<OpportunitySource>(3).fill('inbound'),
  ...Array<OpportunitySource>(3).fill('outbound'),
  ...Array<OpportunitySource>(2).fill('referral'),
  ...Array<OpportunitySource>(3).fill('event'),
  ...Array<OpportunitySource>(1).fill('partner')
]

const OPEN_SOURCES: OpportunitySource[] = ['inbound', 'outbound', 'referral', 'event', 'partner']

const OPEN_STAGES: (typeof STAGE_ORDER)[number][] = [
  ...Array<'new'>(9).fill('new'),
  ...Array<'screening'>(9).fill('screening'),
  ...Array<'meeting'>(9).fill('meeting'),
  ...Array<'proposal'>(6).fill('proposal'),
  ...Array<'customer'>(6).fill('customer')
]

const scaleOpportunities = (): OpportunitySeed[] => {
  const companies = scaleCompanies()
  const owners = ['usr_1', 'usr_2', 'usr_3', 'usr_5', 'usr_7', 'usr_8', 'usr_9', 'usr_10']
  const rows: OpportunitySeed[] = []

  const primaryContact = new Map<string, PersonSeed>()

  for (const person of scalePeople()) {
    if (person.isPrimary && person.companyId && !primaryContact.has(person.companyId)) {
      primaryContact.set(person.companyId, person)
    }
  }

  const oldestCompany = companies.reduce((oldest, company) =>
    company.createdMinutesAgo > oldest.createdMinutesAgo ? company : oldest
  )

  const pickCompany = (createdMinutesAgo: number, nth: number) => {
    const eligible = companies.filter(company => company.createdMinutesAgo > createdMinutesAgo + 8000)

    return eligible.length ? eligible[nth % eligible.length] : oldestCompany
  }

  const pathTo = (stage: (typeof STAGE_ORDER)[number], createdMinutesAgo: number, endMinutesAgo: number) => {
    const steps = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stage) + 1)
    const span = createdMinutesAgo - endMinutesAgo

    return steps.map((step, index) => [
      step,
      index === 0 ? createdMinutesAgo : Math.round(createdMinutesAgo - (span * index) / steps.length)
    ]) as OpportunityStagePath
  }

  const push = (
    outcome: 'open' | 'won' | 'lost',
    stage: (typeof STAGE_ORDER)[number],
    source: OpportunitySource,
    desiredCreatedMinutesAgo: number,
    endMinutesAgo: number,
    closeInMinutes: number,
    closedMinutesAgo?: number
  ) => {
    const index = rows.length
    const company = pickCompany(desiredCreatedMinutesAgo, index)
    const contact = primaryContact.get(company.id)

    const ceiling = Math.min(company.createdMinutesAgo, contact?.createdMinutesAgo ?? Infinity) - 600
    const createdMinutesAgo = Math.min(desiredCreatedMinutesAgo, ceiling)

    rows.push({
      id: `opp_${41 + index}`,
      name: `${DEAL_NAMES[index % DEAL_NAMES.length]} - ${company.name}`,
      stage,
      outcome,
      source,
      probability: outcome === 'won' ? 100 : outcome === 'lost' ? 0 : STAGE_PROBABILITY[stage],
      amount: AMOUNTS[index % AMOUNTS.length],
      companyId: company.id,
      ...(contact ? { pointOfContactId: contact.id } : {}),
      ownerId: owners[index % owners.length],
      closeInMinutes,
      ...(closedMinutesAgo == null ? {} : { closedMinutesAgo }),
      createdMinutesAgo,
      updatedMinutesAgo: Math.min(closedMinutesAgo ?? 600 + index * 40, createdMinutesAgo),
      stagePath: pathTo(stage, createdMinutesAgo, Math.min(endMinutesAgo, createdMinutesAgo - 300))
    })
  }

  for (let index = 0; index < 29; index++) {
    const closed = 2880 + index * 18000
    const created = closed + 45000 + (index % 9) * 14000

    push('won', 'customer', WON_SOURCES[index], created, closed + 900, -closed, closed)
  }

  for (let index = 0; index < 12; index++) {
    const closed = 9000 + index * 40000
    const created = closed + 52000 + (index % 5) * 11000
    const stage = (['screening', 'meeting', 'proposal'] as const)[index % 3]

    push('lost', stage, LOST_SOURCES[index], created, closed + 700, -closed, closed)
  }

  OPEN_STAGES.forEach((stage, index) => {
    const created = 5200 + index * 14500
    const reached = Math.round(created * 0.35)

    const closeInMinutes = index % 11 === 4 ? -(4000 + index * 300) : 20000 + index * 5200

    push('open', stage, OPEN_SOURCES[index % OPEN_SOURCES.length], created, reached, closeInMinutes)
  })

  return rows
}

export const db: OpportunitySeed[] = [
  {
    id: 'opp_1',
    name: 'Enterprise plan upgrade',
    stage: 'proposal',
    outcome: 'open',
    source: 'inbound',
    probability: 75,
    amount: 84000,
    companyId: 'cmp_1',
    pointOfContactId: 'per_1',
    ownerId: 'usr_3',
    closeInMinutes: 60 * 24 * 56,
    createdById: 'usr_3',
    updatedById: 'usr_3',
    createdMinutesAgo: 2353,
    updatedMinutesAgo: 30,
    stagePath: [
      ['new', 2353],
      ['screening', 1800],
      ['meeting', 1100],
      ['proposal', 500]
    ]
  },
  {
    id: 'opp_2',
    name: 'Platform expansion - research org',
    stage: 'proposal',
    outcome: 'open',
    source: 'outbound',
    probability: 75,
    amount: 120000,
    companyId: 'cmp_2',
    pointOfContactId: 'per_2',
    ownerId: 'usr_1',
    closeInMinutes: 60 * 24 * 71,
    createdMinutesAgo: 15374,
    updatedMinutesAgo: 308,
    stagePath: [
      ['new', 15374],
      ['screening', 12000],
      ['meeting', 7000],
      ['proposal', 2500]
    ]
  },
  {
    id: 'opp_3',
    name: 'Annual renewal FY27',
    stage: 'customer',
    outcome: 'won',
    source: 'partner',
    probability: 100,
    amount: 240000,
    companyId: 'cmp_2',
    pointOfContactId: 'per_2',
    ownerId: 'usr_1',
    closeInMinutes: -6944,
    closedMinutesAgo: 6944,

    createdMinutesAgo: 16340,
    updatedMinutesAgo: 6944,
    stagePath: [
      ['new', 16340],
      ['screening', 14500],
      ['meeting', 12000],
      ['proposal', 9500],
      ['customer', 7200]
    ]
  },
  {
    id: 'opp_4',
    name: 'Payments team rollout',
    stage: 'new',
    outcome: 'open',
    source: 'inbound',
    probability: 10,
    amount: 60000,
    companyId: 'cmp_3',
    pointOfContactId: 'per_3',
    ownerId: 'usr_1',
    closeInMinutes: 60 * 24 * 107,
    createdById: 'usr_1',
    updatedById: 'usr_1',
    createdMinutesAgo: 3689,
    updatedMinutesAgo: 600,
    stagePath: [['new', 3689]]
  },
  {
    id: 'opp_5',
    name: 'Design ops renewal',
    stage: 'meeting',
    outcome: 'open',
    source: 'referral',
    probability: 50,
    amount: 96000,
    companyId: 'cmp_4',
    pointOfContactId: 'per_4',
    ownerId: 'usr_2',
    closeInMinutes: 60 * 24 * 26,
    createdMinutesAgo: 9698,
    updatedMinutesAgo: 1004,
    stagePath: [
      ['new', 9698],
      ['screening', 7000],
      ['meeting', 3500]
    ]
  },
  {
    id: 'opp_6',
    name: 'Workspace pilot',
    stage: 'new',
    outcome: 'open',
    source: 'event',
    probability: 10,
    amount: 24000,
    companyId: 'cmp_5',
    pointOfContactId: 'per_5',
    ownerId: 'usr_7',
    closeInMinutes: 60 * 24 * 118,
    createdById: 'usr_7',
    updatedById: 'usr_7',
    createdMinutesAgo: 6360,
    updatedMinutesAgo: 1352,
    stagePath: [['new', 6360]]
  },
  {
    id: 'opp_7',
    name: 'Multi-region deployment',
    stage: 'proposal',
    outcome: 'open',
    source: 'outbound',
    probability: 75,
    amount: 320000,
    companyId: 'cmp_6',
    pointOfContactId: 'per_6',
    ownerId: 'usr_1',
    closeInMinutes: 60 * 24 * 41,
    createdMinutesAgo: 32401,
    updatedMinutesAgo: 1616,
    stagePath: [
      ['new', 32401],
      ['screening', 26000],
      ['meeting', 16000],
      ['proposal', 6000]
    ]
  },
  {
    id: 'opp_8',
    name: 'Ads team seats',
    stage: 'screening',
    outcome: 'open',
    source: 'outbound',
    probability: 25,
    amount: 45000,
    companyId: 'cmp_7',
    pointOfContactId: 'per_7',
    ownerId: 'usr_8',
    closeInMinutes: 60 * 24 * -7,
    createdMinutesAgo: 24722,
    updatedMinutesAgo: 10380,
    stagePath: [
      ['new', 24722],
      ['screening', 18000]
    ]
  },
  {
    id: 'opp_9',
    name: 'Enterprise agreement',
    stage: 'meeting',
    outcome: 'open',
    source: 'partner',
    probability: 50,
    amount: 450000,
    companyId: 'cmp_8',
    pointOfContactId: 'per_8',
    ownerId: 'usr_3',
    closeInMinutes: 60 * 24 * 10,
    createdMinutesAgo: 37075,
    updatedMinutesAgo: 656,
    stagePath: [
      ['new', 37075],
      ['screening', 30000],
      ['meeting', 20000]
    ]
  },
  {
    id: 'opp_10',
    name: 'Business unit expansion',
    stage: 'new',
    outcome: 'open',
    source: 'inbound',
    probability: 10,
    amount: 150000,
    companyId: 'cmp_8',
    pointOfContactId: 'per_8',
    ownerId: 'usr_3',
    closeInMinutes: 60 * 24 * 132,
    createdById: 'usr_3',
    updatedById: 'usr_3',
    createdMinutesAgo: 3021,
    updatedMinutesAgo: 350,
    stagePath: [['new', 3021]]
  },
  {
    id: 'opp_11',
    name: 'Developer platform licence',
    stage: 'customer',
    outcome: 'won',
    source: 'inbound',
    probability: 100,
    amount: 72000,
    companyId: 'cmp_11',
    pointOfContactId: 'per_11',
    ownerId: 'usr_3',
    closeInMinutes: -6638,
    closedMinutesAgo: 6638,
    createdMinutesAgo: 11701,
    updatedMinutesAgo: 6638,
    stagePath: [
      ['new', 11701],
      ['screening', 10000],
      ['meeting', 8800],
      ['proposal', 7600],
      ['customer', 6800]
    ]
  },
  {
    id: 'opp_12',
    name: 'Commerce platform renewal',
    stage: 'screening',
    outcome: 'open',
    source: 'event',
    probability: 25,
    amount: 130000,
    companyId: 'cmp_13',
    pointOfContactId: 'per_13',
    ownerId: 'usr_9',
    closeInMinutes: 60 * 24 * 15,
    createdMinutesAgo: 14038,
    updatedMinutesAgo: 1018,
    stagePath: [
      ['new', 14038],
      ['screening', 9000]
    ]
  },
  {
    id: 'opp_13',
    name: 'Team collaboration tier',
    stage: 'customer',
    outcome: 'won',
    source: 'referral',
    probability: 100,
    amount: 88000,
    companyId: 'cmp_14',
    pointOfContactId: 'per_14',
    ownerId: 'usr_1',
    closeInMinutes: -400,
    closedMinutesAgo: 400,
    createdById: 'usr_1',
    updatedById: 'usr_1',
    createdMinutesAgo: 5024,
    updatedMinutesAgo: 44,
    stagePath: [
      ['new', 5024],
      ['screening', 4200],
      ['meeting', 3200],
      ['proposal', 2000],
      ['customer', 800]
    ]
  },
  {
    id: 'opp_14',
    name: 'Streaming infrastructure',
    stage: 'customer',
    outcome: 'won',
    source: 'outbound',
    probability: 100,
    amount: 210000,
    companyId: 'cmp_15',
    pointOfContactId: 'per_15',
    ownerId: 'usr_2',
    closeInMinutes: -17280,
    closedMinutesAgo: 17280,
    createdMinutesAgo: 60780,
    updatedMinutesAgo: 17280,
    stagePath: [
      ['new', 60780],
      ['screening', 52000],
      ['meeting', 42000],
      ['proposal', 30000],
      ['customer', 20000]
    ]
  },
  {
    id: 'opp_15',
    name: 'Creative suite seats',
    stage: 'meeting',
    outcome: 'open',
    source: 'event',
    probability: 50,
    amount: 175000,
    companyId: 'cmp_16',
    pointOfContactId: 'per_16',
    ownerId: 'usr_2',
    closeInMinutes: 60 * 24 * 57,
    createdMinutesAgo: 8363,
    updatedMinutesAgo: 1978,
    stagePath: [
      ['new', 8363],
      ['screening', 5500],
      ['meeting', 2600]
    ]
  },

  {
    id: 'opp_16',
    name: 'Payments platform - global',
    stage: 'customer',
    outcome: 'won',
    source: 'referral',
    probability: 100,
    amount: 180000,
    companyId: 'cmp_3',
    pointOfContactId: 'per_3',
    ownerId: 'usr_3',
    closeInMinutes: -112000,
    closedMinutesAgo: 112000,
    createdMinutesAgo: 185000,
    updatedMinutesAgo: 112000,
    stagePath: [
      ['new', 185000],
      ['screening', 170000],
      ['meeting', 150000],
      ['proposal', 130000],
      ['customer', 115000]
    ]
  },
  {
    id: 'opp_17',
    name: 'Search infrastructure agreement',
    stage: 'customer',
    outcome: 'won',
    source: 'outbound',
    probability: 100,
    amount: 420000,
    companyId: 'cmp_6',
    pointOfContactId: 'per_6',
    ownerId: 'usr_2',
    closeInMinutes: -210000,
    closedMinutesAgo: 210000,
    createdMinutesAgo: 295000,
    updatedMinutesAgo: 210000,
    stagePath: [
      ['new', 295000],
      ['screening', 280000],
      ['meeting', 258000],
      ['proposal', 235000],
      ['customer', 214000]
    ]
  },
  {
    id: 'opp_18',
    name: 'Enterprise licence - cloud',
    stage: 'customer',
    outcome: 'won',
    source: 'partner',
    probability: 100,
    amount: 510000,
    companyId: 'cmp_8',
    pointOfContactId: 'per_8',
    ownerId: 'usr_5',
    closeInMinutes: -246000,
    closedMinutesAgo: 246000,
    createdMinutesAgo: 335000,
    updatedMinutesAgo: 246000,
    stagePath: [
      ['new', 335000],
      ['screening', 318000],
      ['meeting', 297000],
      ['proposal', 274000],
      ['customer', 251000]
    ]
  },
  {
    id: 'opp_19',
    name: 'Device fleet licence',
    stage: 'customer',
    outcome: 'won',
    source: 'event',
    probability: 100,
    amount: 350000,
    companyId: 'cmp_10',
    pointOfContactId: 'per_10',
    ownerId: 'usr_7',
    closeInMinutes: -390000,
    closedMinutesAgo: 390000,
    createdMinutesAgo: 476000,
    updatedMinutesAgo: 390000,
    stagePath: [
      ['new', 476000],
      ['screening', 459000],
      ['meeting', 438000],
      ['proposal', 414000],
      ['customer', 396000]
    ]
  },
  {
    id: 'opp_20',
    name: 'Accelerated compute cluster',
    stage: 'customer',
    outcome: 'won',
    source: 'event',
    probability: 100,
    amount: 480000,
    companyId: 'cmp_19',
    pointOfContactId: 'per_19',
    ownerId: 'usr_9',
    closeInMinutes: -358000,
    closedMinutesAgo: 358000,
    createdMinutesAgo: 444000,
    updatedMinutesAgo: 358000,
    stagePath: [
      ['new', 444000],
      ['screening', 427000],
      ['meeting', 407000],
      ['proposal', 384000],
      ['customer', 363000]
    ]
  },
  {
    id: 'opp_21',
    name: 'Content delivery renewal',
    stage: 'customer',
    outcome: 'won',
    source: 'partner',
    probability: 100,
    amount: 260000,
    companyId: 'cmp_15',
    pointOfContactId: 'per_15',
    ownerId: 'usr_10',
    closeInMinutes: -36000,
    closedMinutesAgo: 36000,
    createdMinutesAgo: 92000,
    updatedMinutesAgo: 36000,
    stagePath: [
      ['new', 92000],
      ['proposal', 60000],
      ['customer', 40000]
    ]
  },
  {
    id: 'opp_22',
    name: 'Research org expansion',
    stage: 'customer',
    outcome: 'won',
    source: 'inbound',
    probability: 100,
    amount: 195000,
    companyId: 'cmp_2',
    pointOfContactId: 'per_27',
    ownerId: 'usr_1',
    closeInMinutes: -7000,
    closedMinutesAgo: 7000,
    createdById: 'usr_1',
    updatedById: 'usr_1',
    createdMinutesAgo: 34000,
    updatedMinutesAgo: 7000,
    stagePath: [
      ['new', 34000],
      ['meeting', 24000],
      ['proposal', 16000],
      ['customer', 9000]
    ]
  },

  {
    id: 'opp_23',
    name: 'Ads platform integration',
    stage: 'proposal',
    outcome: 'lost',
    source: 'outbound',
    probability: 0,
    amount: 145000,
    companyId: 'cmp_7',
    pointOfContactId: 'per_7',
    ownerId: 'usr_10',
    closeInMinutes: -160000,
    closedMinutesAgo: 160000,
    createdMinutesAgo: 225000,
    updatedMinutesAgo: 160000,
    stagePath: [
      ['new', 225000],
      ['screening', 209000],
      ['meeting', 189000],
      ['proposal', 168000]
    ]
  },
  {
    id: 'opp_24',
    name: 'CRM consolidation',
    stage: 'meeting',
    outcome: 'lost',
    source: 'outbound',
    probability: 0,
    amount: 220000,
    companyId: 'cmp_17',
    pointOfContactId: 'per_17',
    ownerId: 'usr_5',
    closeInMinutes: -335000,
    closedMinutesAgo: 335000,
    createdMinutesAgo: 380000,
    updatedMinutesAgo: 335000,
    stagePath: [
      ['new', 380000],
      ['screening', 364000],
      ['meeting', 345000]
    ]
  },
  {
    id: 'opp_25',
    name: 'Design system licence',
    stage: 'proposal',
    outcome: 'lost',
    source: 'event',
    probability: 0,
    amount: 76000,
    companyId: 'cmp_4',
    pointOfContactId: 'per_4',
    ownerId: 'usr_7',
    closeInMinutes: -44000,
    closedMinutesAgo: 44000,
    createdMinutesAgo: 84000,
    updatedMinutesAgo: 44000,
    stagePath: [
      ['new', 84000],
      ['screening', 74000],
      ['meeting', 62000],
      ['proposal', 50000]
    ]
  },
  {
    id: 'opp_26',
    name: 'Merchant analytics',
    stage: 'screening',
    outcome: 'lost',
    source: 'outbound',
    probability: 0,
    amount: 54000,
    companyId: 'cmp_13',
    pointOfContactId: 'per_13',
    ownerId: 'usr_8',
    closeInMinutes: -102000,
    closedMinutesAgo: 102000,
    createdMinutesAgo: 123000,
    updatedMinutesAgo: 102000,
    stagePath: [
      ['new', 123000],
      ['screening', 110000]
    ]
  },
  {
    id: 'opp_27',
    name: 'Creative cloud enterprise',
    stage: 'meeting',
    outcome: 'lost',
    source: 'event',
    probability: 0,
    amount: 130000,
    companyId: 'cmp_16',
    pointOfContactId: 'per_16',
    ownerId: 'usr_9',
    closeInMinutes: -455000,
    closedMinutesAgo: 455000,
    createdMinutesAgo: 500000,
    updatedMinutesAgo: 455000,
    stagePath: [
      ['new', 500000],
      ['screening', 483000],
      ['meeting', 464000]
    ]
  },
  {
    id: 'opp_28',
    name: 'Workplace analytics pilot',
    stage: 'meeting',
    outcome: 'lost',
    source: 'outbound',
    probability: 0,
    amount: 92000,
    companyId: 'cmp_7',
    pointOfContactId: 'per_7',
    ownerId: 'usr_3',
    closeInMinutes: -66000,
    closedMinutesAgo: 66000,
    createdMinutesAgo: 118000,
    updatedMinutesAgo: 66000,
    stagePath: [
      ['new', 118000],
      ['screening', 98000],
      ['meeting', 80000]
    ]
  },
  {
    id: 'opp_29',
    name: 'Fulfilment network rollout',
    stage: 'proposal',
    outcome: 'lost',
    source: 'inbound',
    probability: 0,
    amount: 168000,
    companyId: 'cmp_9',
    pointOfContactId: 'per_9',
    ownerId: 'usr_10',
    closeInMinutes: -128000,
    closedMinutesAgo: 128000,
    createdMinutesAgo: 205000,
    updatedMinutesAgo: 128000,
    stagePath: [
      ['new', 205000],
      ['screening', 188000],
      ['meeting', 165000],
      ['proposal', 140000]
    ]
  },
  {
    id: 'opp_30',
    name: 'File sync enterprise tier',
    stage: 'screening',
    outcome: 'lost',
    source: 'referral',
    probability: 0,
    amount: 48000,
    companyId: 'cmp_12',
    pointOfContactId: 'per_12',
    ownerId: 'usr_2',
    closeInMinutes: -96000,
    closedMinutesAgo: 96000,
    createdMinutesAgo: 148000,
    updatedMinutesAgo: 96000,
    stagePath: [
      ['new', 148000],
      ['screening', 132000]
    ]
  },

  {
    id: 'opp_31',
    name: 'Rider platform expansion',
    stage: 'proposal',
    outcome: 'open',
    source: 'partner',
    probability: 75,
    amount: 450000,
    companyId: 'cmp_20',
    pointOfContactId: 'per_20',
    ownerId: 'usr_5',
    closeInMinutes: 60 * 24 * 10,
    createdMinutesAgo: 330000,
    updatedMinutesAgo: 656,
    stagePath: [
      ['new', 330000],
      ['screening', 300000],
      ['meeting', 250000],
      ['proposal', 190000]
    ]
  },
  {
    id: 'opp_32',
    name: 'Warehouse compute contract',
    stage: 'proposal',
    outcome: 'open',
    source: 'referral',
    probability: 75,
    amount: 130000,
    companyId: 'cmp_22',
    pointOfContactId: 'per_23',
    ownerId: 'usr_3',
    closeInMinutes: 60 * 24 * 15,
    createdMinutesAgo: 232000,
    updatedMinutesAgo: 1018,
    stagePath: [
      ['new', 232000],
      ['screening', 205000],
      ['meeting', 165000],
      ['proposal', 120000]
    ]
  },
  {
    id: 'opp_33',
    name: 'Base migration programme',
    stage: 'proposal',
    outcome: 'open',
    source: 'inbound',
    probability: 75,
    amount: 275000,
    companyId: 'cmp_18',
    pointOfContactId: 'per_18',
    ownerId: 'usr_10',
    closeInMinutes: 60 * 24 * 71,
    createdMinutesAgo: 575000,
    updatedMinutesAgo: 3400,
    stagePath: [
      ['new', 575000],
      ['screening', 540000],
      ['meeting', 480000],
      ['proposal', 400000]
    ]
  },
  {
    id: 'opp_34',
    name: 'Low-code workspace rollout',
    stage: 'meeting',
    outcome: 'open',
    source: 'inbound',
    probability: 50,
    amount: 96000,
    companyId: 'cmp_21',
    pointOfContactId: 'per_21',
    ownerId: 'usr_8',
    closeInMinutes: 60 * 24 * 18,
    createdMinutesAgo: 314000,
    updatedMinutesAgo: 2200,
    stagePath: [
      ['new', 314000],
      ['screening', 280000],
      ['meeting', 230000]
    ]
  },
  {
    id: 'opp_35',
    name: 'Observability platform',
    stage: 'meeting',
    outcome: 'open',
    source: 'referral',
    probability: 50,
    amount: 175000,
    companyId: 'cmp_23',
    pointOfContactId: 'per_22',
    ownerId: 'usr_5',
    closeInMinutes: 60 * 24 * 23,
    createdMinutesAgo: 191000,
    updatedMinutesAgo: 1978,
    stagePath: [
      ['new', 191000],
      ['screening', 165000],
      ['meeting', 130000]
    ]
  },
  {
    id: 'opp_36',
    name: 'Atlas cluster expansion',
    stage: 'meeting',
    outcome: 'open',
    source: 'partner',
    probability: 50,
    amount: 210000,
    companyId: 'cmp_24',
    pointOfContactId: 'per_24',
    ownerId: 'usr_9',
    closeInMinutes: 60 * 24 * 34,
    createdMinutesAgo: 212000,
    updatedMinutesAgo: 2600,
    stagePath: [
      ['new', 212000],
      ['screening', 180000],
      ['meeting', 145000]
    ]
  },
  {
    id: 'opp_37',
    name: 'Storage tier consolidation',
    stage: 'screening',
    outcome: 'open',
    source: 'inbound',
    probability: 25,
    amount: 45000,
    companyId: 'cmp_12',
    pointOfContactId: 'per_12',
    ownerId: 'usr_7',
    closeInMinutes: 60 * 24 * 63,
    createdMinutesAgo: 158000,
    updatedMinutesAgo: 10380,
    stagePath: [
      ['new', 158000],
      ['screening', 120000]
    ]
  },
  {
    id: 'opp_38',
    name: 'Inference capacity add-on',
    stage: 'screening',
    outcome: 'open',
    source: 'referral',
    probability: 25,
    amount: 320000,
    companyId: 'cmp_19',
    pointOfContactId: 'per_19',
    ownerId: 'usr_8',
    closeInMinutes: 60 * 24 * 66,
    createdMinutesAgo: 25000,
    updatedMinutesAgo: 820,
    stagePath: [
      ['new', 25000],
      ['screening', 13000]
    ]
  },
  {
    id: 'opp_39',
    name: 'Data warehouse evaluation',
    stage: 'new',
    outcome: 'open',
    source: 'partner',
    probability: 10,
    amount: 155000,
    companyId: 'cmp_22',
    pointOfContactId: 'per_23',
    ownerId: 'usr_2',
    closeInMinutes: 60 * 24 * 90,
    createdById: 'usr_2',
    updatedById: 'usr_2',
    createdMinutesAgo: 7200,
    updatedMinutesAgo: 300,
    stagePath: [['new', 7200]]
  },
  {
    id: 'opp_40',
    name: 'Incident response tier',
    stage: 'new',
    outcome: 'open',
    source: 'inbound',
    probability: 10,
    amount: 45000,
    companyId: 'cmp_23',
    pointOfContactId: 'per_22',
    ownerId: 'usr_7',
    closeInMinutes: 60 * 24 * 100,
    createdById: 'usr_7',
    updatedById: 'usr_7',
    createdMinutesAgo: 2600,
    updatedMinutesAgo: 120,
    stagePath: [['new', 2600]]
  },

  ...scaleOpportunities()
]
