// Type Imports
import type { Attachment } from '@/features/nexacrm/types/apps/attachment-types'

export type AttachmentSeed = Omit<Attachment, 'createdAt'> & { createdMinutesAgo: number }

export const db: AttachmentSeed[] = [
  {
    id: 'file_1',
    entityType: 'company',
    entityId: 'cmp_1',
    name: 'Security-Questionnaire-v3.pdf',
    kind: 'pdf',
    sizeBytes: 1_887_436,
    uploaderId: 'usr_3',
    createdMinutesAgo: 60 * 48
  },
  {
    id: 'file_2',
    entityType: 'company',
    entityId: 'cmp_1',
    name: 'Enterprise-Proposal.pdf',
    kind: 'pdf',
    sizeBytes: 942_080,
    uploaderId: 'usr_1',
    createdMinutesAgo: 60 * 20
  },
  {
    id: 'file_3',
    entityType: 'company',
    entityId: 'cmp_2',
    name: 'Pricing-Model.xlsx',
    kind: 'sheet',
    sizeBytes: 268_288,
    uploaderId: 'usr_1',
    createdMinutesAgo: 60 * 10
  },
  {
    id: 'file_4',
    entityType: 'company',
    entityId: 'cmp_8',
    name: 'Mutual-Action-Plan.pptx',
    kind: 'slide',
    sizeBytes: 3_355_443,
    uploaderId: 'usr_3',
    createdMinutesAgo: 60 * 30
  },

  {
    id: 'file_5',
    entityType: 'person',
    entityId: 'per_1',
    name: 'Audit-Log-Spec-v2.pdf',
    kind: 'pdf',
    sizeBytes: 742_318,
    uploaderId: 'usr_3',
    createdMinutesAgo: 60 * 6
  },
  {
    id: 'file_6',
    entityType: 'person',
    entityId: 'per_2',
    name: 'Research-Org-Proposal.pdf',
    kind: 'pdf',
    sizeBytes: 1_204_775,
    uploaderId: 'usr_1',
    createdMinutesAgo: 60 * 11
  },
  {
    id: 'file_7',
    entityType: 'person',
    entityId: 'per_3',
    name: 'Payments-Rollout-Scope.docx',
    kind: 'doc',
    sizeBytes: 96_412,
    uploaderId: 'usr_1',
    createdMinutesAgo: 60 * 33
  },
  {
    id: 'file_8',
    entityType: 'person',
    entityId: 'per_4',
    name: 'Design-Ops-Seat-Usage.xlsx',
    kind: 'sheet',
    sizeBytes: 58_904,
    uploaderId: 'usr_2',
    createdMinutesAgo: 60 * 7
  },
  {
    id: 'file_9',
    entityType: 'person',
    entityId: 'per_5',
    name: 'Workspace-Pilot-Plan.pptx',
    kind: 'slide',
    sizeBytes: 3_115_680,
    uploaderId: 'usr_4',
    createdMinutesAgo: 60 * 22
  },

  {
    id: 'file_task_1',
    entityType: 'task',
    entityId: 'task_1',
    name: 'SSO-audit-log-answers.pdf',
    kind: 'pdf',
    sizeBytes: 412_233,
    uploaderId: 'usr_3',
    createdMinutesAgo: 35
  },

  {
    id: 'file_note_1',
    entityType: 'note',
    entityId: 'note_1',
    name: 'Vendor-comparison-matrix.xlsx',
    kind: 'sheet',
    sizeBytes: 88_412,
    uploaderId: 'usr_3',
    createdMinutesAgo: 100
  }
]
