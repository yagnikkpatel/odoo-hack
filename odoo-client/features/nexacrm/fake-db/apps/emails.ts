// Type Imports
import type { Email } from '@/features/nexacrm/types/apps/email-types'

export type EmailSeed = Omit<Email, 'sentAt'> & { sentMinutesAgo: number }

export const db: EmailSeed[] = [
  {
    id: 'email_1',
    entityType: 'company',
    entityId: 'cmp_1',
    subject: 'Follow-up on enterprise rollout',
    fromName: 'Ada Lovelace',
    fromEmail: 'ada.lovelace@airbnb.com',
    direction: 'inbound',
    snippet: 'Thanks for the demo - the team will continue testing this week and share follow-up questions.',
    personId: 'per_1',
    sentMinutesAgo: 300
  },
  {
    id: 'email_2',
    entityType: 'company',
    entityId: 'cmp_1',
    subject: 'Security review - answers attached',
    fromName: 'Riley Patel',
    fromEmail: 'riley.patel@nexacrm.app',
    direction: 'outbound',
    snippet: 'Shared answers for SSO, audit logging and data-retention questions. Let me know if anything is unclear.',
    personId: 'per_1',
    sentMinutesAgo: 60 * 26
  },
  {
    id: 'email_3',
    entityType: 'company',
    entityId: 'cmp_2',
    subject: 'Renewal FY27 - proposal',
    fromName: 'Alex Morgan',
    fromEmail: 'alex.morgan@nexacrm.app',
    direction: 'outbound',
    snippet: 'Attaching the renewal proposal with the annual-commitment discount we discussed.',
    personId: 'per_2',
    sentMinutesAgo: 60 * 5
  },
  {
    id: 'email_4',
    entityType: 'company',
    entityId: 'cmp_5',
    subject: 'Intro + next steps',
    fromName: 'Elena Novak',
    fromEmail: 'elena@notion.so',
    direction: 'inbound',
    snippet: 'Great to connect. Sharing a few dates for a workspace pilot walkthrough.',
    sentMinutesAgo: 60 * 9
  },

  {
    id: 'email_5',
    entityType: 'person',
    entityId: 'per_1',
    subject: 'Audit-log questions from security',
    fromName: 'Ada Lovelace',
    fromEmail: 'ada.lovelace@airbnb.com',
    direction: 'inbound',
    snippet: 'Two follow-ups from our security lead on retention windows and export format.',
    personId: 'per_1',
    sentMinutesAgo: 210
  },
  {
    id: 'email_6',
    entityType: 'person',
    entityId: 'per_2',
    subject: 'Proposal for the research org',
    fromName: 'Alex Morgan',
    fromEmail: 'alex.morgan@nexacrm.app',
    direction: 'outbound',
    snippet: 'Attaching the 120-seat proposal we discussed, valid through the end of the quarter.',
    toEmail: 'brian.chen@anthropic.com',
    personId: 'per_2',
    sentMinutesAgo: 60 * 9
  },
  {
    id: 'email_7',
    entityType: 'person',
    entityId: 'per_3',
    subject: 'Re: payments rollout timeline',
    fromName: 'Carla Diaz',
    fromEmail: 'carla.diaz@stripe.com',
    direction: 'inbound',
    snippet: 'Platform team can start in Q1 if we get the migration guide before the holidays.',
    personId: 'per_3',
    sentMinutesAgo: 60 * 28
  },
  {
    id: 'email_8',
    entityType: 'person',
    entityId: 'per_4',
    subject: 'Seat usage for the renewal',
    fromName: 'Jamie Chen',
    fromEmail: 'jamie.chen@nexacrm.app',
    direction: 'outbound',
    snippet: 'Here is adoption for the last two quarters, broken down by team.',
    toEmail: 'david.kim@figma.com',
    personId: 'per_4',
    sentMinutesAgo: 60 * 5
  },
  {
    id: 'email_9',
    entityType: 'person',
    entityId: 'per_5',
    subject: 'Workspace pilot - marketing only',
    fromName: 'Elena Novak',
    fromEmail: 'elena.novak@notion.com',
    direction: 'inbound',
    snippet: 'Scoping this to roughly 30 marketing seats first; wider rollout depends on results.',
    personId: 'per_5',
    sentMinutesAgo: 60 * 19
  }
]
