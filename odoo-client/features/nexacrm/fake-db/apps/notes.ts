// Type Imports
import type { NoteTarget } from '@/features/nexacrm/types/apps/record-target'
import type { Note } from '@/features/nexacrm/types/apps/note-types'

// Data Imports
import { scaleCompanies } from '@/features/nexacrm/fake-db/apps/companies'
import { scalePeople } from '@/features/nexacrm/fake-db/apps/people'

export type NoteSeed = Omit<Note, 'createdAt' | 'updatedAt'> & { createdMinutesAgo: number }

const NOTE_TITLES = [
  'Discovery call summary',
  'Procurement notes',
  'Compliance review outcome',
  'Pricing discussion',
  'Stakeholder map',
  'Renewal risk',
  'Competitive positioning',
  'Technical requirements',
  'Budget conversation',
  'Onboarding handover',
  'Executive sponsor mapping',
  'Contract redlines'
]

const NOTE_BODIES = [
  'Captured the main requirements and the timeline they are working to.',
  'Procurement wants a two-week review window before signature.',
  'The infrastructure team signed off; the remaining question is data residency.',
  'Discussed tiering - they are comparing annual against monthly.',
  'Champion is engaged, but the economic buyer has not been met yet.',
  'Usage has dipped this quarter; worth a check-in before renewal.'
]

const NOTE_STATUS_CYCLE = ['shared', 'idea', 'shared', 'archived', 'shared', 'idea'] as const

const NOTE_AUTHORS = ['usr_1', 'usr_2', 'usr_3', 'usr_5', 'usr_7', 'usr_8', 'usr_9', 'usr_10']

type NoteBatch = { notes: NoteSeed[]; targets: NoteTarget[] }

const scaleNotes = (): NoteBatch => {
  const companies = scaleCompanies()
  const people = scalePeople()
  const notes: NoteSeed[] = []
  const targets: NoteTarget[] = []

  for (let index = 0; index < 90; index++) {
    const id = `note_${22 + index}`
    const company = companies[(index * 3) % companies.length]

    const created = Math.min(1200 + index * 5800, company.createdMinutesAgo - 400)

    notes.push({
      id,
      title: `${NOTE_TITLES[index % NOTE_TITLES.length]} - ${company.name}`,
      body: NOTE_BODIES[index % NOTE_BODIES.length],
      status: NOTE_STATUS_CYCLE[index % NOTE_STATUS_CYCLE.length],
      createdById: NOTE_AUTHORS[index % NOTE_AUTHORS.length],
      createdMinutesAgo: created
    })

    targets.push({ id: `ntgt_${24 + targets.length}`, noteId: id, targetCompanyId: company.id })

    const contact = people.find(person => person.companyId === company.id && person.isPrimary)

    if (contact && index % 3 === 0) {
      targets.push({ id: `ntgt_${24 + targets.length}`, noteId: id, targetPersonId: contact.id })
    }
  }

  return { notes, targets }
}

const NOTE_BATCH = scaleNotes()

export const db: NoteSeed[] = [
  {
    id: 'note_1',
    status: 'shared',
    title: 'Vendor comparison requested',
    body: 'The buyer asked for a side-by-side comparison against their current vendor, focused on SSO, audit logging and data residency.',
    createdById: 'usr_3',
    createdMinutesAgo: 120
  },
  {
    id: 'note_2',
    status: 'archived',
    title: 'Technical workshop planned',
    body: 'Workshop scheduled for next week with the platform and security teams. Ada to bring the infra lead.',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 26
  },
  {
    id: 'note_3',
    title: 'Expansion signal',
    body: 'Two additional teams asked about seats for next quarter. Worth a proactive expansion conversation.',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 12
  },
  {
    id: 'note_4',
    status: 'idea',
    title: 'Champion identified',
    body: 'Carla is championing internally and will push for a Q3 start.',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 8
  },
  {
    id: 'note_5',
    status: 'shared',
    title: 'Procurement timeline',
    body: 'Procurement cycle is ~6 weeks; start paperwork early to hit the fiscal-year close.',
    createdById: 'usr_3',
    createdMinutesAgo: 60 * 40
  },
  {
    id: 'note_6',
    status: 'archived',
    title: 'Prefers async updates',
    body: 'Ada prefers written recaps over calls. Keep updates short and bullet-pointed.',
    createdById: 'usr_3',
    createdMinutesAgo: 60 * 5
  },

  {
    id: 'note_7',
    title: 'Procurement blockers',
    body: 'Buyer requested an updated vendor risk matrix and migration checklist.',
    createdById: 'usr_2',
    createdMinutesAgo: 2880
  },
  {
    id: 'note_8',
    status: 'idea',
    title: 'Contract redline summary',
    body: 'Two clauses remain open: liability cap and data residency.',
    createdById: 'usr_4',
    createdMinutesAgo: 5760
  },
  {
    id: 'note_9',
    status: 'shared',
    title: 'Expansion signal',
    body: 'Two additional teams asked about seats for the next quarter.',
    createdById: 'usr_1',
    createdMinutesAgo: 1500
  },
  {
    id: 'note_10',
    status: 'archived',
    title: 'Budget owner identified',
    body: 'Finance signs off above $100k; procurement cycle is roughly six weeks.',
    createdById: 'usr_2',
    createdMinutesAgo: 6480
  },
  {
    id: 'note_11',
    title: 'Champion left the company',
    body: 'Need to rebuild the relationship with the new design ops lead.',
    createdById: 'usr_3',
    createdMinutesAgo: 4320
  },
  {
    id: 'note_12',
    status: 'idea',
    title: 'Inbound signup',
    body: 'Three users signed up from the same domain this month.',
    createdById: 'usr_4',
    createdMinutesAgo: 7200
  },
  {
    id: 'note_13',
    status: 'shared',
    title: 'Procurement paused',
    body: 'Budget freeze until the next fiscal year - revisit in Q1.',
    createdById: 'usr_4',
    createdMinutesAgo: 1440
  },
  {
    id: 'note_14',
    status: 'archived',
    title: 'Expansion opportunity',
    body: 'Two more business units want access after the pilot readout.',
    createdById: 'usr_1',
    createdMinutesAgo: 3600
  },
  {
    id: 'note_15',
    title: 'Decision maker confirmed',
    body: 'Ada signs off on platform spend up to $100k.',
    createdById: 'usr_3',
    createdMinutesAgo: 2400
  },
  {
    id: 'note_16',
    status: 'idea',
    title: 'New design ops lead',
    body: 'Owen took over after the previous champion left; relationship needs rebuilding.',
    createdById: 'usr_2',
    createdMinutesAgo: 4300
  },
  {
    id: 'note_17',
    status: 'shared',
    title: 'Close plan',
    body: 'Order form out this week; targeting end-of-quarter signature.',
    createdById: 'usr_1',
    createdMinutesAgo: 150
  },

  {
    id: 'note_18',
    status: 'archived',
    title: 'Prefers a single decision meeting',
    body: 'Brian would rather run one 45-minute decision meeting with security and procurement in the room than three separate calls. Schedule accordingly.',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 10
  },
  {
    id: 'note_19',
    title: 'Budget sits with the platform team',
    body: 'Carla runs the evaluation but the budget line belongs to the platform team. Expect a second approver before the payments rollout can close.',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 30
  },
  {
    id: 'note_20',
    status: 'idea',
    title: 'Wants usage data before renewing',
    body: 'David asked for seat usage and adoption numbers ahead of the design-ops renewal. He is comparing against an internal build.',
    createdById: 'usr_2',
    createdMinutesAgo: 60 * 6
  },
  {
    id: 'note_21',
    status: 'shared',
    title: 'Pilot limited to the marketing org',
    body: 'Elena scoped the workspace pilot to marketing only - roughly 30 seats - with a wider rollout dependent on the results.',
    createdById: 'usr_4',
    createdMinutesAgo: 60 * 20
  },

  ...NOTE_BATCH.notes
]

export const targetsDb: NoteTarget[] = [
  { id: 'ntgt_1', noteId: 'note_1', targetCompanyId: 'cmp_1' },
  { id: 'ntgt_2', noteId: 'note_1', targetPersonId: 'per_1' },
  { id: 'ntgt_3', noteId: 'note_2', targetCompanyId: 'cmp_1' },
  { id: 'ntgt_4', noteId: 'note_3', targetCompanyId: 'cmp_2' },
  { id: 'ntgt_5', noteId: 'note_4', targetCompanyId: 'cmp_3' },
  { id: 'ntgt_6', noteId: 'note_5', targetCompanyId: 'cmp_8' },
  { id: 'ntgt_7', noteId: 'note_6', targetPersonId: 'per_1' },
  { id: 'ntgt_8', noteId: 'note_7', targetCompanyId: 'cmp_1' },
  { id: 'ntgt_9', noteId: 'note_8', targetCompanyId: 'cmp_1' },
  { id: 'ntgt_10', noteId: 'note_9', targetCompanyId: 'cmp_2' },
  { id: 'ntgt_11', noteId: 'note_10', targetCompanyId: 'cmp_3' },
  { id: 'ntgt_12', noteId: 'note_11', targetCompanyId: 'cmp_4' },
  { id: 'ntgt_13', noteId: 'note_12', targetCompanyId: 'cmp_5' },
  { id: 'ntgt_14', noteId: 'note_13', targetCompanyId: 'cmp_7' },
  { id: 'ntgt_15', noteId: 'note_14', targetCompanyId: 'cmp_8' },
  { id: 'ntgt_16', noteId: 'note_15', targetPersonId: 'per_1' },
  { id: 'ntgt_17', noteId: 'note_16', targetPersonId: 'per_29' },
  { id: 'ntgt_18', noteId: 'note_17', targetOpportunityId: 'opp_1' },
  { id: 'ntgt_19', noteId: 'note_17', targetCompanyId: 'cmp_1' },
  { id: 'ntgt_20', noteId: 'note_18', targetPersonId: 'per_2' },
  { id: 'ntgt_21', noteId: 'note_19', targetPersonId: 'per_3' },
  { id: 'ntgt_22', noteId: 'note_20', targetPersonId: 'per_4' },
  { id: 'ntgt_23', noteId: 'note_21', targetPersonId: 'per_5' },

  ...NOTE_BATCH.targets
]
