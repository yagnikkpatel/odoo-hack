'use client'

// React Imports
import { useState } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import type { LucideIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

export type FieldOption = { label: string; value: string }

type CommonProps = {
  label: string

  /** Field-type icon, mirrored from this field's table column. */
  icon?: LucideIcon

  /** When false the field renders as plain text - no click target, no control. */
  canEdit?: boolean
}

type TextProps = CommonProps & {
  type?: 'text' | 'number'
  value: string

  /** Formatted rendering of `value` ("6,900", "$240K"). Editing always works on the raw value. */
  display?: string
  placeholder?: string

  /** Return a message to reject the commit, or null to accept it. */
  validate?: (raw: string) => string | null
  onCommit: (raw: string) => void
}

type SelectProps = CommonProps & {
  type: 'select'
  value: string
  options: FieldOption[]
  onChange: (value: string) => void

  /** Custom rendering of the current value - a badge, an avatar beside a name. */
  children?: ReactNode
}

type StaticProps = CommonProps & {
  type: 'static'
  children: ReactNode
}

export type RecordFieldProps = TextProps | SelectProps | StaticProps

const Row = ({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: ReactNode }) => (
  <div className='@container'>
    <div className='grid grid-cols-1 items-start gap-1 @3xs:grid-cols-[7.5rem_minmax(0,1fr)] @3xs:gap-2'>
      <span className='text-muted-foreground flex min-h-8 items-center gap-1.5 text-sm'>
        {Icon ? <Icon className='size-3.5 shrink-0 opacity-70' /> : null}
        <span className='truncate'>{label}</span>
      </span>
      <div className='flex min-h-8 min-w-0 items-center'>{children}</div>
    </div>
  </div>
)

const TextField = ({
  label,
  icon,
  canEdit = true,
  type = 'text',
  value,
  display,
  placeholder = 'Empty',
  validate,
  onCommit
}: TextProps) => {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    const trimmed = (draft ?? '').trim()

    if (trimmed === value) {
      setDraft(null)
      setError(null)

      return
    }

    const message = validate?.(trimmed) ?? null

    if (message) {
      setError(message)

      return
    }

    onCommit(trimmed)
    setDraft(null)
    setError(null)
  }

  const shown = value ? (display ?? value) : placeholder

  return (
    <Row label={label} icon={icon}>
      <div className='w-full min-w-0'>
        {draft !== null ? (
          <Input
            type={type}
            value={draft}
            autoFocus
            aria-label={label}
            aria-invalid={Boolean(error)}
            placeholder={placeholder}
            className='h-8'
            onChange={event => {
              setDraft(event.target.value)
              if (error) setError(null)
            }}
            onBlur={commit}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                setDraft(null)
                setError(null)
              }
            }}
          />
        ) : canEdit ? (
          <Button
            variant='ghost'
            title={value || undefined}
            onClick={() => {
              setDraft(value)
              setError(null)
            }}
            className='-mx-2 h-8 w-[calc(100%+1rem)] justify-start text-left text-sm font-normal'
          >
            <span className={cn('min-w-0 truncate', !value && 'text-muted-foreground')}>{shown}</span>
          </Button>
        ) : (
          <span title={value || undefined} className={cn('block truncate text-sm', !value && 'text-muted-foreground')}>
            {shown}
          </span>
        )}

        {error ? <p className='text-destructive pt-1 text-xs'>{error}</p> : null}
      </div>
    </Row>
  )
}

const SelectField = ({ label, icon, canEdit = true, value, options, onChange, children }: SelectProps) => (
  <Row label={label} icon={icon}>
    <SearchableSelect
      label={label}
      value={value}
      options={options}
      disabled={!canEdit}
      onChange={onChange}
      selectedContent={children}
      className={cn('w-full', children && 'border-0 p-0')}
    />
  </Row>
)

const RecordField = (props: RecordFieldProps) => {
  if (props.type === 'static') {
    return (
      <Row label={props.label} icon={props.icon}>
        {props.children}
      </Row>
    )
  }

  if (props.type === 'select') return <SelectField {...props} />

  return <TextField {...props} />
}

export default RecordField
