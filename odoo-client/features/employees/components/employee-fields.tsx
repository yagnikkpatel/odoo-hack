'use client'
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarPlusIcon,
  ClockIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
  ChevronDownIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/nexacrm/components/ui/collapsible'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { formatDate } from '@/features/nexacrm/utils/format'
import { useEmployeesStore } from '../store'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS, employeeName } from '../types'
import type {
  Employee,
  EmployeeInput,
  EmployeeStatus,
  EmploymentType,
} from '../types'

export default function EmployeeFields({ employee }: { employee: Employee }) {
  const { can } = useCurrentUser()
  const canEdit = can('records:update')
  const employees = useEmployeesStore((state) => state.employees)
  const update = useEmployeesStore((state) => state.updateEmployee)
  const set = (input: Partial<EmployeeInput>) => update(employee.id, input)
  return (
    <div className="space-y-4">
      <RecordGroup title="Contact">
        <RecordField
          label="Work email"
          icon={MailIcon}
          canEdit={canEdit}
          value={employee.email}
          placeholder="Add work email"
          validate={(value) =>
            !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
              ? null
              : 'Enter a valid work email.'
          }
          onCommit={(email) => set({ email })}
        />
        <RecordField
          label="Phone"
          icon={PhoneIcon}
          canEdit={canEdit}
          value={employee.phone || ''}
          placeholder="Add phone"
          onCommit={(phone) => set({ phone: phone || undefined })}
        />
        <RecordField
          label="City"
          icon={MapPinIcon}
          canEdit={canEdit}
          value={employee.city || ''}
          placeholder="Not set"
          onCommit={(city) => set({ city: city || undefined })}
        />
        <RecordField
          label="Country"
          icon={MapPinIcon}
          canEdit={canEdit}
          value={employee.country || ''}
          placeholder="Not set"
          onCommit={(country) => set({ country: country || undefined })}
        />
      </RecordGroup>
      <RecordGroup title="Work">
        <RecordField
          label="Department"
          icon={BuildingIcon}
          canEdit={canEdit}
          value={employee.department || ''}
          placeholder="Set department"
          onCommit={(department) =>
            set({ department: department || undefined })
          }
        />
        <RecordField
          label="Job position"
          icon={BriefcaseIcon}
          canEdit={canEdit}
          value={employee.jobTitle || ''}
          placeholder="Set job position"
          onCommit={(jobTitle) => set({ jobTitle: jobTitle || undefined })}
        />
        <RecordField
          type="select"
          label="Manager"
          icon={UserIcon}
          canEdit={canEdit}
          value={employee.managerId || 'none'}
          options={[
            { value: 'none', label: 'Not assigned' },
            ...employees
              .filter((item) => item.id !== employee.id)
              .map((item) => ({ value: item.id, label: employeeName(item) })),
          ]}
          onChange={(managerId) =>
            set({ managerId: managerId === 'none' ? undefined : managerId })
          }
        />
        <RecordField
          type="select"
          label="Status"
          icon={UsersIcon}
          canEdit={canEdit}
          value={employee.status || 'none'}
          options={[
            { value: 'none', label: 'Not set' },
            ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          onChange={(status) =>
            set({
              status:
                status === 'none' ? undefined : (status as EmployeeStatus),
            })
          }
        />
        <RecordField
          type="select"
          label="Employee type"
          icon={BriefcaseIcon}
          canEdit={canEdit}
          value={employee.employmentType || 'none'}
          options={[
            { value: 'none', label: 'Not set' },
            ...Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          onChange={(employmentType) =>
            set({
              employmentType:
                employmentType === 'none'
                  ? undefined
                  : (employmentType as EmploymentType),
            })
          }
        />
        <RecordField type="static" label="Schedule" icon={ClockIcon}>
          <span
            className="text-muted-foreground text-sm"
            title="Working schedules will be connected when that module is built"
          >
            Not assigned · Soon
          </span>
        </RecordField>
      </RecordGroup>
      <RecordGroup title="Related records">
        <div className="grid grid-cols-2 gap-2 py-1">
          {[
            { label: 'Contracts', icon: FileTextIcon },
            { label: 'Attendance', icon: ClockIcon },
            { label: 'Time off', icon: CalendarIcon },
            { label: 'Allocations', icon: CalendarPlusIcon },
          ].map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              disabled
              className="justify-start"
              title={label + ' will be connected when the module is built'}
            >
              <Icon />
              <span>{label}</span>
              <span className="ml-auto text-[10px]">Soon</span>
            </Button>
          ))}
        </div>
      </RecordGroup>
      <Collapsible className="group/metadata">
        <CollapsibleTrigger className="text-muted-foreground flex h-7 w-full items-center justify-between text-xs">
          Record details
          <ChevronDownIcon className="size-3.5 group-data-open/metadata:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 pt-1">
          <RecordField type="static" label="Created" icon={CalendarPlusIcon}>
            <span className="text-sm">{formatDate(employee.createdAt)}</span>
          </RecordField>
          <RecordField type="static" label="Created by" icon={UserIcon}>
            <UserChip userId={employee.createdById} />
          </RecordField>
          <RecordField type="static" label="Last update" icon={CalendarIcon}>
            <span className="text-sm">{formatDate(employee.updatedAt)}</span>
          </RecordField>
          <RecordField type="static" label="Updated by" icon={PencilIcon}>
            <UserChip userId={employee.updatedById} />
          </RecordField>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
