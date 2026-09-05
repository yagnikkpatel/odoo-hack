// Type Imports
import type { ParentRef } from '@/features/nexacrm/types/apps/record-ref'

export const FILE_KINDS = ['pdf', 'doc', 'sheet', 'slide', 'image', 'archive', 'other'] as const

export type FileKind = (typeof FILE_KINDS)[number]

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  pdf: 'PDF',
  doc: 'DOC',
  sheet: 'SHEET',
  slide: 'SLIDE',
  image: 'IMAGE',
  archive: 'ZIP',
  other: 'FILE'
}

export type Attachment = ParentRef & {
  id: string
  name: string
  kind: FileKind
  sizeBytes: number
  uploaderId?: string
  createdAt: string
}

export type AttachmentInput = Omit<Attachment, 'id' | 'createdAt'>

const EXTENSION_KINDS: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  txt: 'doc',
  csv: 'sheet',
  xls: 'sheet',
  xlsx: 'sheet',
  ppt: 'slide',
  pptx: 'slide',
  key: 'slide',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  zip: 'archive',
  rar: 'archive',
  gz: 'archive'
}

export const fileKindFromName = (name: string): FileKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''

  return EXTENSION_KINDS[ext] ?? 'other'
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
