// Type Imports
import type { TaskTarget } from '@/features/nexacrm/types/apps/record-target'
import type { Task } from '@/features/nexacrm/types/apps/task-types'

// Data Imports
import { scaleCompanies } from '@/features/nexacrm/fake-db/apps/companies'
import { scalePeople } from '@/features/nexacrm/fake-db/apps/people'

export type TaskSeed = Omit<Task, 'createdAt' | 'updatedAt' | 'dueAt'> & {
  createdMinutesAgo: number
  dueInMinutes?: number
}

const TASK_TITLES = [
  'Follow up on the proposal',
  'Complete the vendor risk review',
  'Schedule a technical deep dive',
  'Send the revised pricing',
  'Confirm the procurement timeline',
  'Book the executive briefing',
  'Chase the signed order form',
  'Review the integration scope',
  'Share the onboarding plan',
  'Collect the compliance documents',
  'Arrange the reference call',
  'Update the close plan',
  'Draft the renewal terms',
  'Walk through the migration steps',
  'Set up the pilot workspace',
  'Summarise the discovery call'
]

const TASK_STATUS_CYCLE = ['done', 'done', 'in_progress', 'todo', 'todo', 'done', 'todo'] as const

const TASK_ASSIGNEES = ['usr_1', 'usr_2', 'usr_3', 'usr_5', 'usr_7', 'usr_8', 'usr_9', 'usr_10']

type TaskBatch = { tasks: TaskSeed[]; targets: TaskTarget[] }

const scaleTasks = (): TaskBatch => {
  const companies = scaleCompanies()
  const people = scalePeople()
  const tasks: TaskSeed[] = []
  const targets: TaskTarget[] = []

  for (let index = 0; index < 130; index++) {
    const id = `task_${24 + index}`
    const company = companies[index % companies.length]
    const status = TASK_STATUS_CYCLE[index % TASK_STATUS_CYCLE.length]

    const created = Math.min(900 + index * 4000, company.createdMinutesAgo - 400)

    const dueInMinutes =
      status === 'done' ? -(created - 2000) : index % 9 === 3 ? -(2000 + index * 90) : 1400 + index * 520

    tasks.push({
      id,
      title: `${TASK_TITLES[index % TASK_TITLES.length]} - ${company.name}`,
      status,
      assigneeId: TASK_ASSIGNEES[index % TASK_ASSIGNEES.length],
      createdById: TASK_ASSIGNEES[(index + 3) % TASK_ASSIGNEES.length],
      createdMinutesAgo: created,
      dueInMinutes
    })

    targets.push({ id: `tgt_${35 + targets.length}`, taskId: id, targetCompanyId: company.id })

    const contact = people.find(person => person.companyId === company.id && person.isPrimary)

    if (contact && index % 2 === 0) {
      targets.push({ id: `tgt_${35 + targets.length}`, taskId: id, targetPersonId: contact.id })
    }
  }

  return { tasks, targets }
}

const TASK_BATCH = scaleTasks()

export const db: TaskSeed[] = [
  {
    id: 'task_1',
    title: 'Send follow-up on enterprise rollout',
    body: 'Recap the SSO + audit-log answers from the security review.',
    status: 'todo',
    assigneeId: 'usr_3',
    createdById: 'usr_1',
    createdMinutesAgo: 40,
    dueInMinutes: 60 * 24
  },
  {
    id: 'task_2',
    title: 'Finalize security questionnaire',
    body: 'Waiting for legal feedback on data-retention clause.',
    status: 'in_progress',
    assigneeId: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 180,
    dueInMinutes: -60 * 3
  },
  {
    id: 'task_3',
    title: 'Confirm procurement approver',
    body: 'Need confirmation from Ada Lovelace before the next call.',
    status: 'todo',
    assigneeId: 'usr_1',
    createdById: 'usr_3',
    createdMinutesAgo: 320,
    dueInMinutes: 60 * 48
  },
  {
    id: 'task_4',
    title: 'Prepare weekly account update',
    body: 'Send recap to the account owner.',
    status: 'todo',
    assigneeId: 'usr_3',
    createdById: 'usr_1',
    createdMinutesAgo: 600
  },
  {
    id: 'task_5',
    title: 'Schedule Q3 business review',
    status: 'in_progress',
    assigneeId: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 900,
    dueInMinutes: 60 * 24 * 5
  },
  {
    id: 'task_6',
    title: 'Draft mutual action plan',
    body: 'Align milestones with the Enterprise plan upgrade opportunity.',
    status: 'done',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 24
  },
  {
    id: 'task_7',
    title: 'Verify CRM account metadata',
    body: 'Address, domain and LinkedIn confirmed.',
    status: 'done',
    assigneeId: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 60 * 30
  },
  {
    id: 'task_8',
    title: 'Loop in solutions engineer',
    status: 'todo',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 5,
    dueInMinutes: 60 * 24 * 2
  },

  {
    id: 'task_9',
    title: 'Share updated pricing proposal',
    body: 'Enterprise tier with annual commitment.',
    status: 'in_progress',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 120,
    dueInMinutes: 60 * 24
  },
  {
    id: 'task_10',
    title: 'Review renewal terms with legal',
    status: 'todo',
    assigneeId: 'usr_1',
    createdById: 'usr_3',
    createdMinutesAgo: 400,
    dueInMinutes: -60 * 24
  },
  {
    id: 'task_11',
    title: 'Log kickoff call notes',
    status: 'done',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 20
  },

  {
    id: 'task_12',
    title: 'Scope payments rollout',
    status: 'in_progress',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 240,
    dueInMinutes: 60 * 24 * 3
  },
  {
    id: 'task_13',
    title: 'Book technical deep-dive',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 500
  },

  {
    id: 'task_14',
    title: 'Prepare enterprise agreement redlines',
    status: 'in_progress',
    assigneeId: 'usr_3',
    createdById: 'usr_1',
    createdMinutesAgo: 300,
    dueInMinutes: 60 * 24
  },
  {
    id: 'task_15',
    title: 'Align on co-sell motion',
    assigneeId: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 720
  },

  {
    id: 'task_16',
    title: 'Get intro to VP of Engineering',
    status: 'todo',
    assigneeId: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 90,
    dueInMinutes: 60 * 24
  },
  {
    id: 'task_17',
    title: 'Send order form for signature',
    status: 'todo',
    assigneeId: 'usr_3',
    createdById: 'usr_1',
    createdMinutesAgo: 150,
    dueInMinutes: 60 * 24 * 2
  },

  {
    id: 'task_18',
    title: 'Share the audit-log spec with Ada',
    body: 'She owns the security sign-off for the enterprise rollout.',
    status: 'todo',
    assigneeId: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 60 * 5,
    dueInMinutes: 60 * 20
  },
  {
    id: 'task_19',
    title: 'Send the research-org proposal',
    body: 'Pricing for the 120-seat expansion, valid to the end of the quarter.',
    status: 'todo',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 9,
    dueInMinutes: 60 * 30
  },
  {
    id: 'task_20',
    title: 'Confirm FY27 renewal paperwork received',
    status: 'done',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 72
  },
  {
    id: 'task_21',
    title: 'Qualify the payments rollout timeline',
    body: 'Which teams go first, and what blocks a Q1 start.',
    status: 'todo',
    assigneeId: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 60 * 14,
    dueInMinutes: 60 * 48
  },
  {
    id: 'task_22',
    title: 'Prep the design-ops renewal call',
    body: 'Bring seat usage for the last two quarters.',
    status: 'todo',
    assigneeId: 'usr_2',
    createdById: 'usr_2',
    createdMinutesAgo: 60 * 3,
    dueInMinutes: 60 * 12
  },
  {
    id: 'task_23',
    title: 'Follow up on the workspace pilot scope',
    status: 'todo',
    assigneeId: 'usr_4',
    createdById: 'usr_2',
    createdMinutesAgo: 60 * 26,
    dueInMinutes: 60 * 60
  },

  ...TASK_BATCH.tasks
]

export const targetsDb: TaskTarget[] = [
  { id: 'tgt_1', taskId: 'task_1', targetCompanyId: 'cmp_1' },
  { id: 'tgt_2', taskId: 'task_1', targetPersonId: 'per_1' },
  { id: 'tgt_3', taskId: 'task_1', targetOpportunityId: 'opp_1' },

  { id: 'tgt_4', taskId: 'task_2', targetCompanyId: 'cmp_1' },

  { id: 'tgt_5', taskId: 'task_3', targetCompanyId: 'cmp_1' },
  { id: 'tgt_6', taskId: 'task_3', targetPersonId: 'per_1' },

  { id: 'tgt_7', taskId: 'task_4', targetCompanyId: 'cmp_1' },
  { id: 'tgt_8', taskId: 'task_5', targetCompanyId: 'cmp_1' },

  { id: 'tgt_9', taskId: 'task_6', targetCompanyId: 'cmp_1' },
  { id: 'tgt_10', taskId: 'task_6', targetOpportunityId: 'opp_1' },

  { id: 'tgt_11', taskId: 'task_7', targetCompanyId: 'cmp_1' },
  { id: 'tgt_12', taskId: 'task_8', targetCompanyId: 'cmp_1' },

  { id: 'tgt_13', taskId: 'task_9', targetCompanyId: 'cmp_2' },
  { id: 'tgt_14', taskId: 'task_9', targetOpportunityId: 'opp_2' },
  { id: 'tgt_15', taskId: 'task_10', targetCompanyId: 'cmp_2' },
  { id: 'tgt_16', taskId: 'task_10', targetOpportunityId: 'opp_3' },
  { id: 'tgt_17', taskId: 'task_11', targetCompanyId: 'cmp_2' },

  { id: 'tgt_18', taskId: 'task_12', targetCompanyId: 'cmp_3' },
  { id: 'tgt_19', taskId: 'task_13', targetCompanyId: 'cmp_3' },

  { id: 'tgt_20', taskId: 'task_14', targetCompanyId: 'cmp_8' },
  { id: 'tgt_21', taskId: 'task_14', targetOpportunityId: 'opp_9' },
  { id: 'tgt_22', taskId: 'task_15', targetCompanyId: 'cmp_8' },

  { id: 'tgt_23', taskId: 'task_16', targetPersonId: 'per_1' },
  { id: 'tgt_24', taskId: 'task_17', targetOpportunityId: 'opp_1' },

  { id: 'tgt_25', taskId: 'task_18', targetPersonId: 'per_1' },
  { id: 'tgt_26', taskId: 'task_18', targetCompanyId: 'cmp_1' },
  { id: 'tgt_27', taskId: 'task_19', targetPersonId: 'per_2' },
  { id: 'tgt_28', taskId: 'task_19', targetCompanyId: 'cmp_2' },
  { id: 'tgt_29', taskId: 'task_20', targetPersonId: 'per_2' },
  { id: 'tgt_30', taskId: 'task_21', targetPersonId: 'per_3' },
  { id: 'tgt_31', taskId: 'task_21', targetCompanyId: 'cmp_3' },
  { id: 'tgt_32', taskId: 'task_22', targetPersonId: 'per_4' },
  { id: 'tgt_33', taskId: 'task_22', targetOpportunityId: 'opp_5' },
  { id: 'tgt_34', taskId: 'task_23', targetPersonId: 'per_5' },

  ...TASK_BATCH.targets
]
