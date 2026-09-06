'use client'

import { useState } from 'react'
import { Button } from '@/features/nexacrm/components/ui/button'

export function usePayrollPage<T>(rows: T[], filterKey: string) {
  const [selection, setSelection] = useState({ key: filterKey, page: 0 })
  const pageCount = Math.max(1, Math.ceil(rows.length / 25))
  const page = selection.key === filterKey ? Math.min(selection.page, pageCount - 1) : 0
  return { items: rows.slice(page * 25, (page + 1) * 25), page, pageCount, count: rows.length, setPage: (value: number) => setSelection({ key: filterKey, page: value }) }
}

export function PayrollPagination({ page, pageCount, count, setPage, noun }: { page: number; pageCount: number; count: number; setPage: (page: number) => void; noun: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
    <span>{count.toLocaleString()} {noun}{count === 1 ? '' : 's'}</span>
    <div className="flex items-center gap-3"><span>Page {page + 1} of {pageCount}</span><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button><Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next page</Button></div>
  </div>
}
