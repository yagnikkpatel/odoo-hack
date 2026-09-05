'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/features/nexacrm/components/ui/tabs'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { Choice, FormField, EditorDialog } from '@/features/hr/components/form'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { hoursLabel } from '@/features/attendance/types'
import { useSchedulesStore } from './store'
import { SCHEDULE_TYPES, weeklyMinutes } from './types'
import type { WorkingSchedule } from './types'
import WeekPattern from './week-pattern'

export default function ScheduleContent({
  schedule,
}: {
  schedule: WorkingSchedule
}) {
  const employees = useEmployeesStore((state) => state.employees)
  const assignments = useSchedulesStore((state) => state.assignments)
  const schedules = useSchedulesStore((state) => state.schedules)
  const [assigning, setAssigning] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { can } = useCurrentUser()
  const assigned = employees.filter(
    (employee) => assignments[employee.id] === schedule.id,
  )
  const current = schedules.find(
    (schedule) => schedule.id === assignments[employeeId],
  )
  return (
    <div className="space-y-4">
      <RecordGroup title="Working schedule">
        <h2 className="break-words text-base font-semibold">{schedule.name}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {SCHEDULE_TYPES[schedule.type]} ·{' '}
          {hoursLabel(weeklyMinutes(schedule))} / week
        </p>
      </RecordGroup>
      <Tabs defaultValue="pattern" className="gap-4">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="pattern">Weekly pattern</TabsTrigger>
          <TabsTrigger value="employees">
            Employees · {assigned.length}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pattern">
          <WeekPattern schedule={schedule} compact />
          <p className="text-muted-foreground mt-3 text-xs">
            Net hours exclude breaks. This pattern repeats weekly.
          </p>
        </TabsContent>
        <TabsContent value="employees" className="space-y-3">
          {can('records:update') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEmployeeId('')
                setError(null)
                setAssigning(true)
              }}
            >
              <PlusIcon />
              Assign employee
            </Button>
          )}
          {assigned.map((employee) => (
            <div
              key={employee.id}
              className="flex min-w-0 items-center gap-2 border-b py-2"
            >
              <PersonAvatar
                name={employeeName(employee)}
                src={employee.avatar}
                className="size-6"
              />
              <Link
                className="min-w-0 flex-1 truncate text-sm hover:underline"
                href={'/employees/' + employee.id}
              >
                {employeeName(employee)}
              </Link>
              {can('records:update') && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={'Unassign ' + employeeName(employee)}
                  onClick={() => {
                    const result = useSchedulesStore
                      .getState()
                      .assign(employee.id)
                    if (!result.ok) toast.error(result.error)
                  }}
                >
                  <XIcon />
                </Button>
              )}
            </div>
          ))}
          {!assigned.length && (
            <p className="text-muted-foreground py-4 text-sm">
              No employees assigned yet.
            </p>
          )}
        </TabsContent>
      </Tabs>
      {assigning && (
        <EditorDialog
          title="Assign working schedule"
          description="Each employee has one current working schedule."
          submitLabel="Assign schedule"
          onClose={() => setAssigning(false)}
          error={error}
          onSubmit={(event) => {
            event.preventDefault()
            const result = useSchedulesStore
              .getState()
              .assign(employeeId, schedule.id)
            if (!result.ok) {
              setError(result.error)
              return
            }
            setAssigning(false)
          }}
        >
          <FormField id="schedule-employee" label="Employee">
            <Choice
              id="schedule-employee"
              value={employeeId}
              options={employees
                .filter((employee) => assignments[employee.id] !== schedule.id)
                .map((employee) => ({
                  value: employee.id,
                  label: employeeName(employee),
                }))}
              onChange={setEmployeeId}
            />
          </FormField>
          <p className="text-muted-foreground text-sm">
            {current
              ? `This will replace “${current.name}” with “${schedule.name}”.`
              : `Assign “${schedule.name}” to the selected employee.`}
          </p>
        </EditorDialog>
      )}
    </div>
  )
}
