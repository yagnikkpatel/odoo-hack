'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import useTimeOffData from './use-time-off-data'

export default function TimeOffDetailPage({
  title,
  backHref,
  backLabel,
  loading,
  missing,
  error,
  actions,
  children
}: {
  title: string
  backHref: string
  backLabel: string
  loading?: boolean
  missing?: boolean
  error?: string | null
  actions?: ReactNode
  children?: ReactNode
}) {
  useTimeOffData()
  if (loading)
    return (
      <p role='status' className='py-8 text-sm'>
        Loading {backLabel.toLowerCase()}…
      </p>
    )
  // A failed load must not be mistaken for a deleted record.
  if (error)
    return (
      <p role='alert' className='text-destructive py-8 text-sm'>
        {error}
      </p>
    )
  if (missing) return <RecordNotFound label={title} backHref={backHref} backLabel={backLabel} />
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2 border-b py-3'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={`Back to ${backLabel.toLowerCase()}`}
          render={<Link href={backHref} />}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className='mr-auto min-w-0 text-base font-semibold break-words'>{title}</h1>
        {actions}
      </div>
      <Card className='max-w-3xl'>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
