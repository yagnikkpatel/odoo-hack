'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'

export default function TimeOffDetailPage({
  title,
  backHref,
  backLabel,
  loading,
  missing,
  actions,
  children
}: {
  title: string
  backHref: string
  backLabel: string
  loading?: boolean
  missing?: boolean
  actions?: ReactNode
  children?: ReactNode
}) {
  if (loading)
    return (
      <p role='status' className='py-8 text-sm'>
        Loading {backLabel.toLowerCase()}…
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
