'use client'

import { useRef } from 'react'
import type { RefObject } from 'react'
import Link from 'next/link'
import { ClockIcon, ExternalLinkIcon, HomeIcon, XIcon } from 'lucide-react'
import {
  parseAsString,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { Button } from '@/features/nexacrm/components/ui/button'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/features/nexacrm/components/ui/tabs'
import PreviewSheet from '@/features/nexacrm/components/record/preview-sheet'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { employeeName } from './types'
import type { Employee } from './types'
import EmployeeFields from './components/employee-fields'
import EmployeeTimeline from './components/employee-timeline'
import EmployeeActions from './components/employee-actions'
import EmployeeAttendance from '@/features/attendance/employee-attendance'
import { useEmployeeRecord } from './components/use-employee-record'
import EmployeeLoadState from './components/employee-load-state'

export const useEmployeePreview = () =>
  useQueryState(
    'record',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )

function PanelContent({
  employee,
  onClose,
  headingRef,
}: {
  employee: Employee
  onClose: () => void
  headingRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div
        ref={headingRef}
        tabIndex={-1}
        className="flex h-12.5 shrink-0 items-center gap-2 border-b px-4 outline-none"
      >
        <PersonAvatar
          name={employeeName(employee)}
          src={employee.avatar}
          size="default"
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {employeeName(employee)}
        </h2>
        <EmployeeActions employee={employee} onDelete={onClose} />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close panel"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <Tabs
        key={employee.id}
        defaultValue="details"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-start rounded-none border-b px-2 pb-1 group-data-horizontal/tabs:h-10"
        >
          <TabsTrigger value="details">
            <HomeIcon className="size-3.5" /> Details
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <ClockIcon className="size-3.5" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <ClockIcon className="size-3.5" /> Attendance
          </TabsTrigger>
        </TabsList>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            <TabsContent value="details">
              <EmployeeFields employee={employee} />
            </TabsContent>
            <TabsContent value="timeline">
              <EmployeeTimeline employeeId={employee.id} />
            </TabsContent>
            <TabsContent value="attendance">
              <EmployeeAttendance employeeId={employee.id} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
      <div className="shrink-0 border-t p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          render={<Link href={'/employees/' + employee.id} />}
        >
          <ExternalLinkIcon /> Open full profile
        </Button>
      </div>
    </>
  )
}

export default function EmployeePanel() {
  const [id, setId] = useEmployeePreview()
  const { employee, isLoading, error, retry } = useEmployeeRecord(id)
  const headingRef = useRef<HTMLDivElement>(null)
  let title = 'Employee details'
  if (employee) title = employeeName(employee) + ' details'

  let content
  if (isLoading || error || !employee) {
    let loadError = error
    if (!isLoading && !error && id) loadError = 'Employee not found.'
    content = (
      <>
        <div
          ref={headingRef}
          tabIndex={-1}
          className="flex h-12.5 items-center justify-between border-b px-4 outline-none"
        >
          <h2 className="text-sm font-medium">Employee details</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close panel"
            onClick={() => setId(null)}
          >
            <XIcon />
          </Button>
        </div>
        <EmployeeLoadState error={loadError} onRetry={retry} />
      </>
    )
  } else {
    content = (
      <PanelContent
        employee={employee}
        onClose={() => setId(null)}
        headingRef={headingRef}
      />
    )
  }

  return (
    <PreviewSheet
      open={Boolean(id)}
      onClose={() => setId(null)}
      title={title}
      initialFocus={headingRef}
    >
      {content}
    </PreviewSheet>
  )
}
