'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, LoaderCircleIcon } from 'lucide-react'
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
import EditableTitle from '@/features/nexacrm/components/record/editable-title'
import { splitPersonName } from '@/features/nexacrm/types/apps/person-types'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useEmployee, useEmployeesStore } from './store'
import { employeeName } from './types'
import EmployeeFields from './components/employee-fields'
import EmployeeTimeline from './components/employee-timeline'
import EmployeeActions from './components/employee-actions'
import EmployeeAttendance from '@/features/attendance/employee-attendance'

export default function EmployeeDetail({ employeeId }: { employeeId: string }) {
  const router = useRouter()
  const [railOpen, setRailOpen] = useState(false)
  const employee = useEmployee(employeeId)
  const employees = useEmployeesStore((state) => state.employees)
  const hasHydrated = useEmployeesStore((state) => state.hasHydrated)
  const update = useEmployeesStore((state) => state.updateEmployee)
  const { can } = useCurrentUser()
  if (!employee)
    return hasHydrated ? (
      <RecordNotFound
        label="Employee"
        backHref="/employees"
        backLabel="Employees"
      />
    ) : (
      <div className="flex flex-1 items-center justify-center py-16">
        <LoaderCircleIcon className="text-muted-foreground size-5 animate-spin" />
      </div>
    )
  const index = employees.findIndex((item) => item.id === employeeId)
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to employees"
          render={<Link href="/employees" />}
          className="text-muted-foreground hover:text-foreground -ml-1 shrink-0"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PersonAvatar
              name={employeeName(employee)}
              src={employee.avatar}
              size="default"
            />
            <h1 className="min-w-0">
              <EditableTitle
                key={employee.id}
                value={employeeName(employee)}
                canEdit={can('records:update')}
                placeholder="Employee name"
                ariaLabel="Employee name"
                onCommit={(name) => update(employee.id, splitPersonName(name))}
                className="text-base font-semibold tracking-tight"
              />
            </h1>
            {employee.jobTitle && (
              <span className="text-muted-foreground shrink-0 truncate text-xs max-lg:hidden">
                {employee.jobTitle}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RecordNavigation
            index={index}
            total={employees.length}
            moduleLabel="Employees"
            previousHref={
              index > 0 ? '/employees/' + employees[index - 1].id : undefined
            }
            nextHref={
              index < employees.length - 1
                ? '/employees/' + employees[index + 1].id
                : undefined
            }
          />
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
