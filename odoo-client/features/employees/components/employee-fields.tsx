'use client'

import { useState } from 'react'
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarPlusIcon,
  ChevronDownIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/nexacrm/components/ui/collapsible'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import EmployeeContractsLink from '@/features/contracts/components/employee-contracts-link'
import { EmployeeAttendanceLink } from '@/features/attendance/employee-attendance'
import EmployeeTimeOffLinks from '@/features/time-off/components/employee-links'
import { useEmployeePermissions } from '../permissions'
import type { Employee } from '../types'
import EmployeeCompany from './employee-company'
import EmployeeStatusBadge from './status-badge'
import EditEmployeeDialog from './edit-employee-dialog'
import ProfileImages from './profile-images'

function dateLabel(value?: string): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function EmployeeFields({ employee }: { employee: Employee }) {
  const { canUpdate } = useEmployeePermissions()
  const [editing, setEditing] = useState(false)

  return (
    <div className="space-y-4">
      {canUpdate && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setEditing(true)}
        >
          <PencilIcon /> Edit employee
        </Button>
      )}
      <RecordGroup title="Contact">
        <RecordField type="static" label="Work email" icon={MailIcon}>
          <span className="break-all text-sm">
            {employee.email || 'Not set'}
          </span>
        </RecordField>
        <RecordField type="static" label="Phone" icon={PhoneIcon}>
          <span className="text-sm">{employee.phone || 'Not set'}</span>
        </RecordField>
        <RecordField type="static" label="Location" icon={MapPinIcon}>
          <span className="text-sm">{employee.location || 'Not set'}</span>
        </RecordField>
      </RecordGroup>
      <RecordGroup title="Work">
        <RecordField type="static" label="Company" icon={BuildingIcon}>
          <EmployeeCompany employee={employee} />
        </RecordField>
        <RecordField type="static" label="Department" icon={BuildingIcon}>
          <span className="text-sm">{employee.department || 'Not set'}</span>
        </RecordField>
        <RecordField type="static" label="Job position" icon={BriefcaseIcon}>
          <span className="text-sm">{employee.jobTitle || 'Not set'}</span>
        </RecordField>
        <RecordField type="static" label="Manager" icon={UserIcon}>
          <span className="text-sm">
            {employee.managerName || 'Not assigned'}
          </span>
        </RecordField>
        <RecordField type="static" label="Status" icon={UsersIcon}>
          <EmployeeStatusBadge status={employee.status} />
        </RecordField>
        <RecordField type="static" label="Work location" icon={MapPinIcon}>
          <span className="text-sm">{employee.workLocation || 'Not set'}</span>
        </RecordField>
        <RecordField type="static" label="Schedule" icon={ClockIcon}>
          <span className="text-sm">
            {employee.workingSchedule || 'Not set'}
          </span>
        </RecordField>
      </RecordGroup>
      <ProfileImages employee={employee} />
      <RecordGroup title="Related records">
        <p className="text-muted-foreground pb-2 text-xs">
          These modules are awaiting their data connections.
        </p>
        <div className="grid grid-cols-2 gap-2 py-1">
          <EmployeeContractsLink employeeId={employee.id} />
          <EmployeeAttendanceLink employeeId={employee.id} />
          <EmployeeTimeOffLinks employeeId={employee.id} />
        </div>
      </RecordGroup>
      <Collapsible className="group/metadata">
        <CollapsibleTrigger className="text-muted-foreground flex h-7 w-full items-center justify-between text-xs">
          Record details
          <ChevronDownIcon className="size-3.5 group-data-open/metadata:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 pt-1">
          <RecordField type="static" label="Created" icon={CalendarPlusIcon}>
            <span className="text-sm">{dateLabel(employee.createdAt)}</span>
          </RecordField>
          <RecordField type="static" label="Last update" icon={CalendarIcon}>
            <span className="text-sm">{dateLabel(employee.updatedAt)}</span>
          </RecordField>
        </CollapsibleContent>
      </Collapsible>
      <EditEmployeeDialog
        employee={employee}
        open={editing}
        onOpenChange={setEditing}
      />
    </div>
  )
}
