'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/features/nexacrm/components/ui/tabs'
import SidePanel, {
  SidePanelTrigger,
} from '@/features/nexacrm/components/layout/side-panel'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import RecordNavigation from '@/features/nexacrm/components/record/record-navigation'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { useEmployeesStore } from './store'
import { employeeName } from './types'
import EmployeeFields from './components/employee-fields'
import EmployeeTimeline from './components/employee-timeline'
import EmployeeActions from './components/employee-actions'
import EmployeeAttendance from '@/features/attendance/employee-attendance'
import { useEmployeeRecord } from './components/use-employee-record'
import EmployeeLoadState from './components/employee-load-state'
import { useEmployeePermissions } from './permissions'

export default function EmployeeDetail({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const { canReadAll } = useEmployeePermissions()
  const [railOpen, setRailOpen] = useState(false)
  const { employee, isLoading, error, retry } = useEmployeeRecord(employeeId)
  const employees = useEmployeesStore((state) => state.employees)
  if (isLoading || error)
    return <EmployeeLoadState error={error} onRetry={retry} />
  if (!employee) {
    return (
      <RecordNotFound
        label="Employee"
        backHref="/employees"
        backLabel="Employees"
      />
    )
  }
  const index = employees.findIndex((item) => item.id === employeeId)
  let previousHref: string | undefined
  let nextHref: string | undefined
  if (index > 0) previousHref = '/employees/' + employees[index - 1].id
  if (index >= 0 && index < employees.length - 1)
    nextHref = '/employees/' + employees[index + 1].id
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b py-2">
        {canReadAll && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to employees"
            render={<Link href="/employees" />}
            className="text-muted-foreground hover:text-foreground -ml-1 shrink-0"
          >
            <ArrowLeftIcon />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PersonAvatar
              name={employeeName(employee)}
              src={employee.avatar}
              size="default"
            />
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">
              {employeeName(employee)}
            </h1>
            {employee.jobTitle && (
              <span className="text-muted-foreground shrink-0 truncate text-xs max-lg:hidden">
                {employee.jobTitle}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canReadAll && index >= 0 && (
            <RecordNavigation
              index={index}
              total={employees.length}
              moduleLabel="Employees on this page"
              previousHref={previousHref}
              nextHref={nextHref}
            />
          )}
          <SidePanelTrigger
            side="left"
            breakpoint="xl"
            label="Show employee details"
            onClick={() => setRailOpen(true)}
          />
          <EmployeeActions
            employee={employee}
            onDelete={() => router.push('/employees')}
          />
        </div>
      </div>
      <div className="grid xl:min-h-0 xl:flex-1 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        <SidePanel
          side="left"
          breakpoint="xl"
          open={railOpen}
          onOpenChange={setRailOpen}
          title={employeeName(employee) + ' details'}
          description="Employee contact and work details."
          className="xl:min-h-0 xl:border-r"
        >
          <ScrollArea className="xl:h-full">
            <div className="xl:py-4 xl:pr-4">
              <EmployeeFields employee={employee} />
            </div>
          </ScrollArea>
        </SidePanel>
        <ScrollArea className="xl:min-h-0 xl:flex-1">
          <div className="py-4 xl:px-4">
            <Tabs key={employee.id} defaultValue="timeline" className="gap-4">
              <TabsList variant="line">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline">
                <EmployeeTimeline employeeId={employee.id} />
              </TabsContent>
              <TabsContent value="attendance">
                <EmployeeAttendance employeeId={employee.id} />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
