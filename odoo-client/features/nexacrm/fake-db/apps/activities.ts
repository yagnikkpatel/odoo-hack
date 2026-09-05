// Type Imports
import type { Activity, ActivityType } from '@/features/nexacrm/types/apps/activity-types'

// Data Imports
import { scaleCompanies } from '@/features/nexacrm/fake-db/apps/companies'
import { scalePeople } from '@/features/nexacrm/fake-db/apps/people'

export type ActivitySeed = Omit<Activity, 'occurredAt'> & { minutesAgo: number }

const ACTIVITY_PLAN: { type: ActivityType; verb: string; subject: string }[] = [
  { type: 'call', verb: 'logged a call with', subject: 'the account team' },
  { type: 'email', verb: 'sent a proposal to', subject: 'the buying committee' },
  { type: 'meeting', verb: 'held a discovery call with', subject: 'the platform team' },
  { type: 'note', verb: 'added a note to', subject: 'the close plan' },
  { type: 'status', verb: 'moved the opportunity to', subject: 'Proposal' },
  { type: 'email', verb: 'received a reply from', subject: 'procurement' },
  { type: 'task', verb: 'completed', subject: 'the vendor risk review' },
  { type: 'call', verb: 'left a voicemail for', subject: 'the economic buyer' },
  { type: 'file', verb: 'attached', subject: 'the signed order form' },
  { type: 'meeting', verb: 'scheduled', subject: 'the executive briefing' }
]

const ACTIVITY_ACTORS = ['usr_1', 'usr_2', 'usr_3', 'usr_5', 'usr_7', 'usr_8', 'usr_9', 'usr_10']

const scaleActivities = (): ActivitySeed[] => {
  const companies = scaleCompanies()
  const people = scalePeople()
  const rows: ActivitySeed[] = []

  for (let index = 0; index < 420; index++) {
    const plan = ACTIVITY_PLAN[index % ACTIVITY_PLAN.length]

    const minutesAgo = 60 + index * index * 3

    const eligible = companies.filter(item => item.createdMinutesAgo > minutesAgo + 600)
    const company = eligible.length ? eligible[index % eligible.length] : companies[companies.length - 1]

    if (company.createdMinutesAgo <= minutesAgo) continue

    const contact = people.find(person => person.companyId === company.id && person.isPrimary)
    const onPerson = index % 4 === 1 && contact && contact.createdMinutesAgo > minutesAgo

    rows.push({
      id: `act_${50 + rows.length}`,
      entityType: onPerson ? 'person' : 'company',
      entityId: onPerson ? contact.id : company.id,
      type: plan.type,
      actorId: ACTIVITY_ACTORS[index % ACTIVITY_ACTORS.length],
      verb: plan.verb,
      subject: onPerson ? `${contact.firstName} ${contact.lastName}` : company.name,
      minutesAgo
    })
  }

  return rows
}

export const db: ActivitySeed[] = [
  {
    id: 'act_1',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'meeting',
    actorId: 'usr_3',
    verb: 'scheduled',
    subject: 'Quarterly success review',
    body: '8:15 AM to 9:45 AM · Google Meet',
    minutesAgo: -120
  },
  {
    id: 'act_2',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'status',
    actorId: 'usr_2',
    verb: 'changed status in',
    subject: 'IC List to In Review',
    body: 'Legal approved the compliance controls draft after review.',
    minutesAgo: 180
  },
  {
    id: 'act_3',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'meeting',
    actorId: 'usr_2',
    verb: 'hosted',
    subject: 'Implementation kick-off',
    body: '10:30 AM to 11:15 AM · Zoom',
    minutesAgo: 300
  },
  {
    id: 'act_4',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'email',
    actorId: 'usr_4',
    verb: 'sent a follow-up to',
    subject: 'the security team',
    body: 'Shared answers for SSO, audit logging and data retention questions.',
    minutesAgo: 420
  },
  {
    id: 'act_5',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'email',
    actorId: 'usr_3',
    verb: 'replied to an email from',
    subject: 'Jerry Halfer',
    body: 'Thanks for the demo. The team will continue testing this week and share follow-up questions.',
    minutesAgo: 1140
  },
  {
    id: 'act_6',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'task',
    actorId: 'usr_1',
    verb: 'updated milestone in',
    subject: 'Onboarding plan',
    body: 'Pilot timeline confirmed with the IT team and procurement.',
    minutesAgo: 1680
  },
  {
    id: 'act_8',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'file',
    verb: 'completed',
    subject: 'Financial records import',
    body: 'QuickBooks and Stripe records were normalised for Q2 analysis.',
    minutesAgo: 3060
  },
  {
    id: 'act_10',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'call',
    actorId: 'usr_3',
    verb: 'logged a call with',
    subject: 'Marta Reyes',
    body: '22 minutes · Walked through pricing tiers and the pilot scope.',
    minutesAgo: 7200
  },
  {
    id: 'act_11',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'status',
    actorId: 'usr_3',
    verb: 'moved the account to',

    subject: 'Prospect',
    minutesAgo: 10080
  },
  {
    id: 'act_12',
    entityType: 'company',
    entityId: 'cmp_1',
    type: 'task',
    actorId: 'usr_1',
    verb: 'created',
    subject: 'Send security questionnaire',
    body: 'Due before the technical review call.',
    minutesAgo: 11520
  },

  {
    id: 'act_13',
    entityType: 'company',
    entityId: 'cmp_2',
    type: 'meeting',
    actorId: 'usr_1',
    verb: 'scheduled',
    subject: 'Technical deep dive',
    body: '2:00 PM to 3:00 PM · Google Meet',
    minutesAgo: -45
  },
  {
    id: 'act_14',
    entityType: 'company',
    entityId: 'cmp_2',
    type: 'email',
    actorId: 'usr_1',
    verb: 'sent a proposal to',
    subject: 'the platform team',
    body: 'Enterprise tier with annual commitment and priority support.',
    minutesAgo: 240
  },
  {
    id: 'act_16',
    entityType: 'company',
    entityId: 'cmp_2',
    type: 'call',
    actorId: 'usr_2',
    verb: 'logged a call with',
    subject: 'Priya Raman',
    body: '35 minutes · Reviewed rollout plan for the research org.',
    minutesAgo: 4320
  },
  {
    id: 'act_17',
    entityType: 'company',
    entityId: 'cmp_2',
    type: 'status',
    actorId: 'usr_1',
    verb: 'marked the account as',
    subject: 'ICP',
    minutesAgo: 8640
  },

  {
    id: 'act_18',
    entityType: 'company',
    entityId: 'cmp_3',
    type: 'email',
    actorId: 'usr_1',
    verb: 'received a reply from',
    subject: 'Dana Whitfield',
    body: 'Asked for a side-by-side comparison against their current tooling.',
    minutesAgo: 90
  },
  {
    id: 'act_19',
    entityType: 'company',
    entityId: 'cmp_3',
    type: 'task',
    actorId: 'usr_1',
    verb: 'created',
    subject: 'Prepare comparison deck',
    body: 'Needed before Thursday review.',
    minutesAgo: 150
  },
  {
    id: 'act_20',
    entityType: 'company',
    entityId: 'cmp_3',
    type: 'meeting',
    actorId: 'usr_2',
    verb: 'hosted',
    subject: 'Discovery call',
    body: '45 minutes · Zoom',
    minutesAgo: 2160
  },

  {
    id: 'act_22',
    entityType: 'company',
    entityId: 'cmp_4',
    type: 'call',
    actorId: 'usr_2',
    verb: 'logged a call with',
    subject: 'Owen Castillo',
    body: '18 minutes · Renewal timing and seat forecast.',
    minutesAgo: 600
  },
  {
    id: 'act_23',
    entityType: 'company',
    entityId: 'cmp_4',
    type: 'file',
    actorId: 'usr_2',
    verb: 'attached',
    subject: 'Renewal quote FY27.pdf',
    minutesAgo: 660
  },
  {
    id: 'act_25',
    entityType: 'company',
    entityId: 'cmp_4',
    type: 'status',
    actorId: 'usr_2',
    verb: 'moved the account to',
    subject: 'At risk',
    minutesAgo: 4380
  },

  {
    id: 'act_26',
    entityType: 'company',
    entityId: 'cmp_5',
    type: 'email',
    actorId: 'usr_4',
    verb: 'sent an intro email to',
    subject: 'the workspace team',
    body: 'No reply yet - follow up scheduled for next week.',
    minutesAgo: 2880
  },

  {
    id: 'act_28',
    entityType: 'company',
    entityId: 'cmp_6',
    type: 'meeting',
    actorId: 'usr_1',
    verb: 'scheduled',
    subject: 'Executive briefing',
    body: '9:00 AM to 10:00 AM · Google Meet',
    minutesAgo: -1440
  },
  {
    id: 'act_29',
    entityType: 'company',
    entityId: 'cmp_6',
    type: 'task',
    actorId: 'usr_1',
    verb: 'completed',
    subject: 'Security review packet',
    body: 'SOC 2 report and pen-test summary sent to their compliance team.',
    minutesAgo: 720
  },
  {
    id: 'act_30',
    entityType: 'company',
    entityId: 'cmp_6',
    type: 'call',
    actorId: 'usr_1',
    verb: 'logged a call with',
    subject: 'Nathan Osei',
    body: '50 minutes · Multi-region deployment requirements.',
    minutesAgo: 2880
  },
  {
    id: 'act_31',
    entityType: 'company',
    entityId: 'cmp_6',
    type: 'status',
    verb: 'enriched the record from',
    subject: 'Clearbit',
    minutesAgo: 10080
  },

  {
    id: 'act_33',
    entityType: 'company',
    entityId: 'cmp_7',
    type: 'email',
    actorId: 'usr_4',
    verb: 'received an out-of-office from',
    subject: 'Lena Fischer',
    minutesAgo: 4320
  },

  {
    id: 'act_34',
    entityType: 'company',
    entityId: 'cmp_8',
    type: 'meeting',
    actorId: 'usr_3',
    verb: 'hosted',
    subject: 'Pilot readout',
    body: '11:00 AM to 12:00 PM · Microsoft Teams',
    minutesAgo: 480
  },
  {
    id: 'act_35',
    entityType: 'company',
    entityId: 'cmp_8',
    type: 'task',
    actorId: 'usr_3',
    verb: 'created',
    subject: 'Draft the enterprise agreement',
    body: 'Legal to review before the end of the month.',
    minutesAgo: 540
  },
  {
    id: 'act_36',
    entityType: 'company',
    entityId: 'cmp_8',
    type: 'file',
    actorId: 'usr_3',
    verb: 'attached',
    subject: 'Pilot results summary.xlsx',
    minutesAgo: 600
  },
  {
    id: 'act_38',
    entityType: 'company',
    entityId: 'cmp_8',
    type: 'status',
    actorId: 'usr_3',
    verb: 'moved the account to',

    subject: 'Customer',
    minutesAgo: 8640
  },

  {
    id: 'act_39',
    entityType: 'person',
    entityId: 'per_1',
    type: 'meeting',
    actorId: 'usr_3',
    verb: 'scheduled',
    subject: 'Quarterly success review',
    body: '8:15 AM to 9:45 AM · Google Meet',
    minutesAgo: -120
  },
  {
    id: 'act_41',
    entityType: 'person',
    entityId: 'per_26',
    type: 'email',
    actorId: 'usr_3',
    verb: 'replied to an email from',
    subject: 'Jerry Halfer',
    body: 'Thanks for the demo. The team will continue testing this week and share follow-up questions.',
    minutesAgo: 1140
  },
  {
    id: 'act_42',
    entityType: 'person',
    entityId: 'per_25',
    type: 'call',
    actorId: 'usr_3',
    verb: 'logged a call with',
    subject: 'Marta Reyes',
    body: '22 minutes · Walked through pricing tiers and the pilot scope.',
    minutesAgo: 7200
  },
  {
    id: 'act_43',
    entityType: 'person',
    entityId: 'per_27',
    type: 'call',
    actorId: 'usr_2',
    verb: 'logged a call with',
    subject: 'Priya Raman',
    body: '35 minutes · Reviewed rollout plan for the research org.',
    minutesAgo: 4320
  },
  {
    id: 'act_44',
    entityType: 'person',
    entityId: 'per_29',
    type: 'call',
    actorId: 'usr_2',
    verb: 'logged a call with',
    subject: 'Owen Castillo',
    body: '18 minutes · Renewal timing and seat forecast.',
    minutesAgo: 600
  },
  {
    id: 'act_47',
    entityType: 'person',
    entityId: 'per_30',
    type: 'call',
    actorId: 'usr_1',
    verb: 'logged a call with',
    subject: 'Nathan Osei',
    body: '50 minutes · Multi-region deployment requirements.',
    minutesAgo: 2880
  },
  {
    id: 'act_48',
    entityType: 'person',
    entityId: 'per_33',
    type: 'email',
    actorId: 'usr_2',
    verb: 'sent an intro email to',
    subject: 'Tomas Lindqvist',
    body: 'Inbound from the pricing page - no company linked yet.',
    minutesAgo: 300
  },

  {
    id: 'act_49',
    entityType: 'opportunity',
    entityId: 'opp_1',
    type: 'status',
    actorId: 'usr_3',
    verb: 'moved the opportunity to',
    subject: 'Proposal',
    body: 'Pricing agreed pending procurement sign-off.',
    minutesAgo: 240
  },
  {
    id: 'act_51',
    entityType: 'opportunity',
    entityId: 'opp_2',
    type: 'meeting',
    actorId: 'usr_1',
    verb: 'scheduled',
    subject: 'Expansion planning call',
    body: '30 minutes · Google Meet',
    minutesAgo: -2880
  },
  {
    id: 'act_52',
    entityType: 'opportunity',
    entityId: 'opp_5',
    type: 'email',
    actorId: 'usr_2',
    verb: 'sent a proposal to',
    subject: 'Figma',
    body: 'Design ops renewal with expanded seat count.',
    minutesAgo: 720
  },

  {
    id: 'act_53',
    entityType: 'person',
    entityId: 'per_2',
    type: 'email',
    actorId: 'usr_1',
    verb: 'sent',
    subject: 'Proposal for the research org',
    body: 'Attaching the 120-seat proposal we discussed, valid through the end of the quarter.',
    minutesAgo: 60 * 9
  },
  {
    id: 'act_54',
    entityType: 'person',
    entityId: 'per_2',
    type: 'call',
    actorId: 'usr_1',
    verb: 'logged a call with',
    subject: 'Brian Chen',
    body: 'Wants one decision meeting with security and procurement rather than three calls.',
    minutesAgo: 60 * 34
  },
  {
    id: 'act_55',
    entityType: 'person',
    entityId: 'per_3',
    type: 'meeting',
    actorId: 'usr_1',
    verb: 'held',
    subject: 'Payments discovery call',
    body: 'Platform team can start in Q1 given a migration guide before the holidays.',
    minutesAgo: 60 * 20
  },
  {
    id: 'act_45',
    entityType: 'person',
    entityId: 'per_4',
    type: 'email',
    actorId: 'usr_2',
    verb: 'sent',
    subject: 'Seat usage for the renewal',
    body: 'Adoption for the last two quarters, broken down by team.',
    minutesAgo: 60 * 5
  },

  {
    id: 'act_task_1',
    entityType: 'task',
    entityId: 'task_1',
    type: 'status',
    actorId: 'usr_1',
    verb: 'created',
    subject: 'Send follow-up on enterprise rollout',
    minutesAgo: 40
  },
  {
    id: 'act_task_2',
    entityType: 'task',
    entityId: 'task_1',
    type: 'status',
    actorId: 'usr_3',
    verb: 'updated 2 fields on',
    subject: 'Send follow-up on enterprise rollout',
    changes: [
      { label: 'Assignee', value: 'Riley Patel' },
      { label: 'Due date', value: 'tomorrow' }
    ],
    minutesAgo: 30
  },
  {
    id: 'act_task_3',
    entityType: 'task',
    entityId: 'task_2',
    type: 'status',
    actorId: 'usr_3',
    verb: 'updated 1 field on',
    subject: 'Finalize security questionnaire',
    changes: [{ label: 'Status', value: 'In progress' }],
    minutesAgo: 120
  },

  {
    id: 'act_note_1',
    entityType: 'note',
    entityId: 'note_1',
    type: 'status',
    actorId: 'usr_3',
    verb: 'created',
    subject: 'Vendor comparison requested',
    minutesAgo: 120
  },
  {
    id: 'act_note_2',
    entityType: 'note',
    entityId: 'note_1',
    type: 'status',
    actorId: 'usr_1',
    verb: 'updated 1 field on',
    subject: 'Vendor comparison requested',
    changes: [{ label: 'Body', value: 'Added the data-residency requirement' }],
    minutesAgo: 90
  },

  ...scaleActivities()
]
