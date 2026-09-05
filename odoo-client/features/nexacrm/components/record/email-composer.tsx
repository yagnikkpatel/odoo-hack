'use client'

// React Imports
import { useMemo, useState } from 'react'

// Third-party Imports
import { MailPlusIcon, SendIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

// Type Imports
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import { formatPersonName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/features/nexacrm/components/ui/command'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/features/nexacrm/components/ui/popover'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useEmailsStore } from '@/features/nexacrm/store/use-emails-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

type Recipient = { email: string; name?: string; avatar?: string }

/** One recipient list - chips plus a picker. Used for To, Cc and Bcc. */
const RecipientField = ({
  id,
  label,
  value,
  onChange,
  autoFocus,
  action
}: {
  id: string
  label: string
  value: Recipient[]
  onChange: (next: Recipient[]) => void
  autoFocus?: boolean

  /** Trailing control on the label row - the Cc/Bcc toggle sits here. */
  action?: React.ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const people = usePeopleStore(state => state.people)

  const chosen = new Set(value.map(recipient => recipient.email.toLowerCase()))

  const options = useMemo(
    () => people.filter(person => person.email && !chosen.has(person.email.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, value]
  )

  const add = (recipient: Recipient) => {
    onChange([...value, recipient])
    setQuery('')
    setOpen(false)
  }

  const typed = query.trim()

  const isAddress = /^\S+@\S+\.\S+$/.test(typed)
  const ownedByPerson = people.some(person => person.email.toLowerCase() === typed.toLowerCase())
  const offerTyped = isAddress && !ownedByPerson && !chosen.has(typed.toLowerCase())

  return (
    <div className='space-y-1.5'>
      <div className='flex items-baseline justify-between gap-2'>
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant='outline'
              className='h-auto min-h-9 w-full flex-wrap justify-start gap-1.5 px-2 py-1.5 font-normal'
            />
          }
        >
          {value.length === 0 ? <span className='text-muted-foreground'>Recipients</span> : null}

          {value.map(recipient => (
            <span
              key={recipient.email}
              className='bg-muted flex max-w-full items-center gap-1 rounded-md py-0.5 pr-0.5 pl-1 text-sm'
            >
              <PersonAvatar
                name={recipient.name ?? recipient.email}
                src={recipient.avatar}
                className='size-4'
                fallbackClassName='text-[9px]'
              />
              <span className='min-w-0 truncate'>{recipient.name ?? recipient.email}</span>

              <span
                role='button'
                tabIndex={0}
                aria-label={`Remove ${recipient.name ?? recipient.email}`}
                className='text-muted-foreground hover:text-destructive rounded-sm p-0.5'
                onClick={event => {
                  event.stopPropagation()
                  onChange(value.filter(item => item.email !== recipient.email))
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  event.stopPropagation()
                  onChange(value.filter(item => item.email !== recipient.email))
                }}
              >
                <XIcon className='size-3' />
              </span>
            </span>
          ))}
        </PopoverTrigger>

        <PopoverContent align='start' className='w-80 p-0'>
          <Command>
            <CommandInput
              autoFocus={autoFocus}
              placeholder='Search people or type an address…'
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No matching people - type a full email address to add it.</CommandEmpty>

              {offerTyped ? (
                <CommandGroup>
                  <CommandItem
                    value={typed}
                    onSelect={() => add({ email: typed })}
                    className='[&>svg:last-child]:hidden'
                  >
                    <MailPlusIcon className='size-4 shrink-0' />
                    <span className='min-w-0 truncate'>{typed}</span>
                    <span className='text-muted-foreground ml-auto shrink-0 text-xs'>Add</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}

              <CommandGroup>
                {options.map(person => (
                  <CommandItem
                    key={person.id}
                    value={`${formatPersonName(person)} ${person.email}`}
                    onSelect={() => add({ email: person.email, name: formatPersonName(person), avatar: person.avatar })}
                    className='[&>svg:last-child]:hidden'
                  >
                    <PersonAvatar
                      name={formatPersonName(person)}
                      src={person.avatar}
                      className='size-5'
                      fallbackClassName='text-[10px]'
                    />
                    <span className='shrink-0'>{formatPersonName(person)}</span>
                    <span className='text-muted-foreground min-w-0 flex-1 truncate text-right text-xs'>
                      {person.email}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const EmailComposer = ({
  entityType,
  entityId,
  defaultTo,
  onDone
}: {
  entityType: EntityType
  entityId: string
  defaultTo?: string
  onDone: () => void
}) => {
  const addEmail = useEmailsStore(state => state.addEmail)
  const people = usePeopleStore(state => state.people)
  const { user } = useCurrentUser()

  const [to, setTo] = useState<Recipient[]>(() => {
    if (!defaultTo) return []

    const person = people.find(candidate => candidate.email === defaultTo)

    return [{ email: defaultTo, name: person ? formatPersonName(person) : undefined, avatar: person?.avatar }]
  })

  const [cc, setCc] = useState<Recipient[]>([])
  const [bcc, setBcc] = useState<Recipient[]>([])
  const [showCopies, setShowCopies] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const canSend = to.length > 0 && subject.trim().length > 0

  const send = () => {
    if (!canSend) return

    addEmail({
      entityType,
      entityId,
      subject: subject.trim(),
      fromName: user.name,
      fromEmail: user.email,
      toEmail: to[0].email,
      cc: cc.length ? cc.map(recipient => recipient.email) : undefined,
      bcc: bcc.length ? bcc.map(recipient => recipient.email) : undefined,
      direction: 'outbound',
      snippet: body.trim().slice(0, 140),
      body: body.trim()
    })

    toast.success('Email logged against this record.')
    onDone()
  }

  return (
    <div
      className='space-y-4'
      onKeyDown={event => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send()
      }}
    >
      <RecipientField
        id='email-to'
        label='To'
        value={to}
        onChange={setTo}
        autoFocus
        action={
          showCopies ? null : (
            <Button
              variant='link'
              size='sm'
              onClick={() => setShowCopies(true)}
              className='text-muted-foreground h-auto p-0 text-xs'
            >
              Cc/Bcc
            </Button>
          )
        }
      />

      {showCopies ? (
        <>
          <RecipientField id='email-cc' label='Cc' value={cc} onChange={setCc} />
          <RecipientField id='email-bcc' label='Bcc' value={bcc} onChange={setBcc} />
        </>
      ) : null}

      <div className='space-y-1.5'>
        <Label htmlFor='email-subject'>Subject</Label>
        <Input
          id='email-subject'
          value={subject}
          placeholder='Subject'
          onChange={event => setSubject(event.target.value)}
        />
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='email-body'>Message</Label>
        <Textarea
          id='email-body'
          value={body}
          placeholder='Type something…'
          onChange={event => setBody(event.target.value)}
          className='min-h-48 resize-none'
        />
      </div>

      <div className='flex items-center justify-end gap-2 border-t pt-4'>
        <Button variant='outline' size='sm' onClick={onDone}>
          Cancel
        </Button>
        <Button size='sm' onClick={send} disabled={!canSend}>
          <SendIcon /> Send
          <kbd className='text-primary-foreground/70 ml-1 text-[10px]'>⌘↵</kbd>
        </Button>
      </div>
    </div>
  )
}

export default EmailComposer
