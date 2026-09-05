'use client'

// Third-party Imports
import { ArrowDownLeftIcon, MailIcon, SendIcon } from 'lucide-react'

// Type Imports
import type { Email } from '@/features/nexacrm/types/apps/email-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordPanelLoader from '@/features/nexacrm/components/record/record-panel-loader'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'

// Store Imports
import { useEmailsStore, useEntityEmails } from '@/features/nexacrm/store/use-emails-store'
import { usePersonAvatar } from '@/features/nexacrm/store/use-person-avatar'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatActivityTime } from '@/features/nexacrm/utils/activity-utils'

const EmailRow = ({ email, onOpen }: { email: Email; onOpen: () => void }) => {
  const inbound = email.direction === 'inbound'

  const address = inbound ? email.fromEmail : (email.toEmail ?? email.fromEmail)
  const avatar = usePersonAvatar(address)

  return (
    <li className='hover:bg-accent flex items-start gap-3 rounded-lg border p-3 transition-colors'>
      <span className='relative shrink-0'>
        <PersonAvatar name={email.fromName} src={avatar} size='default' />
        <span
          className={cn(
            'border-background absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full',
            inbound ? 'bg-muted text-sky-600 dark:text-sky-400' : 'bg-muted text-emerald-600 dark:text-emerald-400'
          )}
          aria-hidden
        >
          {inbound ? <ArrowDownLeftIcon className='size-3' /> : <SendIcon className='size-3' />}
        </span>
      </span>

      <Button
        variant='ghost'
        onClick={onOpen}
        className='-my-1 h-auto min-w-0 flex-1 flex-col items-stretch gap-0 px-0 py-1 text-left font-normal hover:bg-transparent'
      >
        <span className='flex items-baseline justify-between gap-2'>
          <span className='min-w-0 truncate text-sm font-medium'>{email.fromName}</span>
          <span className='text-muted-foreground shrink-0 text-xs whitespace-nowrap'>
            {formatActivityTime(email.sentAt)}
          </span>
        </span>
        <span className='truncate text-sm'>{email.subject}</span>
        <span className='text-muted-foreground truncate text-sm'>{email.snippet}</span>
      </Button>
    </li>
  )
}

const EmailsPanel = ({
  entityType,
  entityId,
  onOpenEmail,
  onCompose
}: {
  entityType: EntityType
  entityId: string
  onOpenEmail: (emailId: string) => void
  onCompose: () => void
}) => {
  const emails = useEntityEmails(entityType, entityId)
  const hasHydrated = useEmailsStore(state => state.hasHydrated)
  const canCompose = false // Enabled only after the real email service is connected.

  if (!hasHydrated) return <RecordPanelLoader />

  return (
    <div className='space-y-3'>
      <RecordHeading
        title='Emails'
        count={emails.length}
        onAdd={canCompose ? onCompose : undefined}
        addLabel='New email'
      />

      {emails.length > 0 ? (
        <ul className='space-y-2'>
          {emails.map(email => (
            <EmailRow key={email.id} email={email} onOpen={() => onOpenEmail(email.id)} />
          ))}
        </ul>
      ) : (
        <div className='flex flex-col items-center gap-3 py-14 text-center'>
          <span className='bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-2xl'>
            <MailIcon className='size-5' />
          </span>
          <div className='space-y-1'>
            <p className='text-sm font-medium'>Email connection pending</p>
            <p className='text-muted-foreground text-sm'>Emails will appear after the email service is connected.</p>
          </div>
          {canCompose ? (
            <Button variant='outline' size='sm' onClick={onCompose}>
              <MailIcon /> Send email
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default EmailsPanel
