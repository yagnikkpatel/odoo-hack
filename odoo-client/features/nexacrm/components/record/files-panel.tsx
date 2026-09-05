'use client'

// React Imports
import { useRef, useState } from 'react'

// Third-party Imports
import type { LucideIcon } from 'lucide-react'
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  FileArchiveIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PaperclipIcon,
  PresentationIcon,
  Trash2Icon
} from 'lucide-react'
import { toast } from 'sonner'

// Type Imports
import type { Attachment, FileKind } from '@/features/nexacrm/types/apps/attachment-types'
import { fileKindFromName, formatFileSize } from '@/features/nexacrm/types/apps/attachment-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/features/nexacrm/components/ui/dropdown-menu'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import RecordPanelLoader from '@/features/nexacrm/components/record/record-panel-loader'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useAttachmentsStore, useEntityAttachments } from '@/features/nexacrm/store/use-attachments-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatDate } from '@/features/nexacrm/utils/format'

const MARKS: Record<FileKind, { icon: LucideIcon; className: string }> = {
  pdf: { icon: FileTextIcon, className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  doc: { icon: FileTextIcon, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  sheet: { icon: FileSpreadsheetIcon, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  slide: { icon: PresentationIcon, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  image: { icon: FileImageIcon, className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  archive: { icon: FileArchiveIcon, className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  other: { icon: PaperclipIcon, className: 'bg-muted text-muted-foreground' }
}

const download = (file: Attachment) => {
  const blob = new Blob([`${file.name}\n\nThis template stores file metadata only.`], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}

const FileRow = ({ file, canDelete }: { file: Attachment; canDelete: boolean }) => {
  const deleteAttachment = useAttachmentsStore(state => state.deleteAttachment)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const mark = MARKS[file.kind]

  return (
    <li className='hover:bg-accent flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors'>
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', mark.className)} aria-hidden>
        <mark.icon className='size-4' />
      </span>

      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm'>{file.name}</span>
        <span className='text-muted-foreground text-xs'>{formatFileSize(file.sizeBytes)}</span>
      </span>

      <span className='text-muted-foreground shrink-0 text-xs whitespace-nowrap'>{formatDate(file.createdAt)}</span>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant='ghost' size='icon-sm' aria-label={`Actions for ${file.name}`} />}>
          <EllipsisVerticalIcon className='size-3.5' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-40'>
          <DropdownMenuItem onClick={() => download(file)}>
            <DownloadIcon /> Download
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem variant='destructive' onClick={() => setConfirmOpen(true)}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title='Delete file'
        description={`${file.name} will be removed from this record. This cannot be undone.`}
        confirmLabel='Delete'
        onConfirm={() => {
          deleteAttachment(file.id)
          toast.success('File removed.')
        }}
      />
    </li>
  )
}

const FilesPanel = ({ entityType, entityId }: { entityType: ParentEntityType; entityId: string }) => {
  const files = useEntityAttachments(entityType, entityId)
  const hasHydrated = useAttachmentsStore(state => state.hasHydrated)
  const addAttachment = useAttachmentsStore(state => state.addAttachment)
  const { user, can } = useCurrentUser()
  const inputRef = useRef<HTMLInputElement>(null)

  const canCreate = can('records:create')
  const canDelete = can('records:delete')

  const upload = (list: FileList | null) => {
    if (!list?.length) return

    Array.from(list).forEach(file =>
      addAttachment({
        entityType,
        entityId,
        name: file.name,
        kind: fileKindFromName(file.name),
        sizeBytes: file.size,
        uploaderId: user.id
      })
    )
    toast.success(list.length === 1 ? 'File uploaded.' : `${list.length} files uploaded.`)

    if (inputRef.current) inputRef.current.value = ''
  }

  if (!hasHydrated) return <RecordPanelLoader />

  return (
    <div className='space-y-3'>
      <RecordHeading
        title='Files'
        count={files.length}
        onAdd={canCreate ? () => inputRef.current?.click() : undefined}
        addLabel='Add file'
      />

      <input ref={inputRef} type='file' multiple className='sr-only' onChange={event => upload(event.target.files)} />

      {files.length > 0 ? (
        <ul className='space-y-2'>
          {files.map(file => (
            <FileRow key={file.id} file={file} canDelete={canDelete} />
          ))}
        </ul>
      ) : (
        <DataTableEmptyState
          icon={PaperclipIcon}
          title='No files yet'
          description={
            canCreate ? 'Upload contracts, proposals and attachments for this record.' : 'Shared files appear here.'
          }
        />
      )}
    </div>
  )
}

export default FilesPanel
