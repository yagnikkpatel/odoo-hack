// Component Imports
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'

/**
 * Placeholders shown while a page or panel waits on the API. They mirror the real layout so the
 * content does not jump when it arrives - never a "Loading…" message, which reflows the whole page.
 *
 * ! Server-safe on purpose: these render inside `<Suspense fallback>` in server components, so
 * ! nothing here may import a `'use client'` primitive (the table primitives are client-only).
 */

const range = (length: number) => Array.from({ length }, (_, index) => index)

/** Screen-reader announcement paired with a busy region. */
const LoadingLabel = ({ label }: { label: string }) => <span className='sr-only'>{label}</span>

/** A form control placeholder - matches the 2rem control height used across the app. */
export const FieldSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn('h-8 w-full', className)} />
)

/** Header row plus body rows, sized to sit inside a bordered card. */
export const TableSkeleton = ({ columns = 6, rows = 8 }: { columns?: number; rows?: number }) => (
  <div className='flex flex-1 flex-col'>
    <div className='flex items-center gap-4 border-b px-3 py-2.5'>
      {range(columns).map(column => (
        <Skeleton key={column} className='h-4 flex-1' />
      ))}
    </div>
    {range(rows).map(row => (
      <div key={row} className='flex items-center gap-4 border-b px-3 py-3'>
        {range(columns).map(column => (
          <Skeleton key={column} className='h-5 flex-1' />
        ))}
      </div>
    ))}
  </div>
)

/**
 * The whole record list page: view bar, filter row and table card. Used as the Suspense fallback
 * for every list route so the shell appears immediately.
 */
export const ListPageSkeleton = ({
  columns = 6,
  rows = 8,
  filters = 3,
  label = 'Loading'
}: {
  columns?: number
  rows?: number
  /** Filter controls to outline above the table. Pass 0 for pages without a filter row. */
  filters?: number
  label?: string
}) => (
  <div role='status' aria-busy='true' className='flex min-h-full flex-col'>
    <LoadingLabel label={label} />
    <div className='bg-background -mx-4 flex h-11 shrink-0 items-center gap-2 border-b px-4'>
      <Skeleton className='size-4 shrink-0 rounded' />
      <Skeleton className='h-4 w-28' />
      <div className='ml-auto flex shrink-0 items-center gap-2'>
        <Skeleton className='h-8 w-36 sm:w-56' />
        <Skeleton className='h-8 w-20 max-sm:w-8' />
        <Skeleton className='h-8 w-24 max-sm:w-8' />
      </div>
    </div>
    <div className={PAGE_BODY}>
      {filters > 0 ? (
        <div className='flex flex-wrap items-end gap-3'>
          {range(filters).map(filter => (
            <div key={filter} className='grid w-full min-w-0 gap-1.5 sm:w-52'>
              <Skeleton className='h-3 w-16' />
              <FieldSkeleton />
            </div>
          ))}
        </div>
      ) : null}
      <Card className='flex flex-1 flex-col gap-0 overflow-hidden py-0'>
        <TableSkeleton columns={columns} rows={rows} />
        <div className='mt-auto border-t px-4 py-3'>
          <Skeleton className='h-4 w-40' />
        </div>
      </Card>
    </div>
  </div>
)

/** A single record page: back header plus a card of field pairs. */
export const DetailPageSkeleton = ({ fields = 6, label = 'Loading' }: { fields?: number; label?: string }) => (
  <div role='status' aria-busy='true' className='space-y-4'>
    <LoadingLabel label={label} />
    <div className='flex items-center gap-2 border-b py-3'>
      <Skeleton className='size-7 shrink-0 rounded-md' />
      <Skeleton className='h-5 w-48' />
      <Skeleton className='ml-auto h-8 w-24' />
    </div>
    <Card className='max-w-3xl'>
      <CardContent className='grid gap-x-4 gap-y-5 sm:grid-cols-2'>
        {range(fields).map(field => (
          <div key={field} className='space-y-2'>
            <Skeleton className='h-3 w-20' />
            <Skeleton className='h-4 w-32' />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
)

/** Field pairs on their own, for a side panel that already draws its own header. */
export const RecordFieldsSkeleton = ({ fields = 6, label = 'Loading' }: { fields?: number; label?: string }) => (
  <div role='status' aria-busy='true' className='grid gap-x-4 gap-y-5 sm:grid-cols-2'>
    <LoadingLabel label={label} />
    {range(fields).map(field => (
      <div key={field} className='space-y-2'>
        <Skeleton className='h-3 w-20' />
        <Skeleton className='h-4 w-32' />
      </div>
    ))}
  </div>
)

/** Stacked lines, for lists of cards or history entries. */
export const ListSkeleton = ({ items = 3, label = 'Loading' }: { items?: number; label?: string }) => (
  <div role='status' aria-busy='true' className='space-y-3'>
    <LoadingLabel label={label} />
    {range(items).map(item => (
      <div key={item} className='space-y-2 rounded-lg border p-3'>
        <Skeleton className='h-4 w-40' />
        <Skeleton className='h-3 w-full max-w-md' />
      </div>
    ))}
  </div>
)
