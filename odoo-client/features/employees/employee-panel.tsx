'use client'
import { useRef } from 'react'
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
import EditableTitle from '@/features/nexacrm/components/record/editable-title'
import { splitPersonName } from '@/features/nexacrm/types/apps/person-types'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useEmployee, useEmployeesStore } from './store'
import { employeeName } from './types'
import EmployeeFields from './components/employee-fields'
import EmployeeTimeline from './components/employee-timeline'
import EmployeeActions from './components/employee-actions'
import EmployeeAttendance from '@/features/attendance/employee-attendance'

export const useEmployeePreview = () =>
  useQueryState(
    'record',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )

export default function EmployeePanel() {
  const [id, setId] = useEmployeePreview()
  const employee = useEmployee(id || undefined)
  const update = useEmployeesStore((state) => state.updateEmployee)
  const headingRef = useRef<HTMLDivElement>(null)
  const { can } = useCurrentUser()
  return (
    <PreviewSheet
      open={Boolean(employee)}
      onClose={() => setId(null)}
      title={
        employee ? employeeName(employee) + ' details' : 'Employee details'
      }
      initialFocus={headingRef}
    >
      {employee && (
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
            <div className="min-w-0 flex-1">
              <EditableTitle
                key={employee.id}
                value={employeeName(employee)}
                canEdit={can('records:update')}
                placeholder="Employee name"
                ariaLabel="Employee name"
                onCommit={(name) => update(employee.id, splitPersonName(name))}
                className="text-sm font-medium"
              />
            </div>
            <EmployeeActions employee={employee} onDelete={() => setId(null)} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close panel"
              onClick={() => setId(null)}
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
                <HomeIcon className="size-3.5" />
                Details
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <ClockIcon className="size-3.5" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="attendance">
                <ClockIcon className="size-3.5" />
                Attendance
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
              <ExternalLinkIcon />
              Open full profile
            </Button>
          </div>
        </>
      )}
    </PreviewSheet>
  )
}
