'use client'
import Link from 'next/link'
import {
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  ClockIcon,
  CoinsIcon,
  FileTextIcon,
  UserIcon,
  ChevronDownIcon,
} from 'lucide-react'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/features/nexacrm/components/ui/collapsible'
import { usePayrollStore } from '@/features/payroll/store'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { useEmployee } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { contractStatus, formatContractDate, formatWage } from '../types'
import type { Contract } from '../types'
import ContractStatusBadge from './status-badge'

export default function ContractFields({ contract }: { contract: Contract }) {
  const structure = usePayrollStore(state => state.structures.find(item => item.id === contract.salaryStructure || item.name.toLowerCase() === contract.salaryStructure.toLowerCase()))
  const schedule = useSchedulesStore(state => state.schedules.find(item => item.id === contract.workingSchedule || item.name === contract.workingSchedule))
  const employee = useEmployee(contract.employeeId)
  return (
    <div className="space-y-4">
      <RecordGroup title="Employment">
        <RecordField type="static" label="Employee" icon={UserIcon}>
          {employee ? (
            <Link
              href={'/employees/' + employee.id}
              className="hover:text-primary flex min-w-0 items-center gap-2 text-sm"
            >
              <PersonAvatar
                name={employeeName(employee)}
                src={employee.avatar}
                className="size-5"
              />
              <span className="truncate">{employeeName(employee)}</span>
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">
              Employee unavailable
            </span>
          )}
        </RecordField>
        <RecordField type="static" label="Department" icon={BuildingIcon}>
          <span className="text-sm break-words">{contract.department}</span>
        </RecordField>
        <RecordField type="static" label="Job position" icon={BriefcaseIcon}>
          <span className="text-sm break-words">{contract.jobPosition}</span>
        </RecordField>
        <RecordField type="static" label="Status" icon={FileTextIcon}>
          <ContractStatusBadge status={contractStatus(contract)} />
        </RecordField>
      </RecordGroup>
      <RecordGroup title="Contract terms">
        <RecordField type="static" label="Start date" icon={CalendarIcon}>
          <span className="text-sm">
            {formatContractDate(contract.startDate)}
          </span>
        </RecordField>
        <RecordField type="static" label="End date" icon={CalendarIcon}>
          <span className="text-sm">
            {formatContractDate(contract.endDate)}
          </span>
        </RecordField>
        <RecordField type="static" label="Duration" icon={ClockIcon}>
          <span className="text-sm">
            {contract.endDate ? 'Fixed term' : 'Open-ended'}
          </span>
        </RecordField>
        <RecordField type="static" label="Wage" icon={CoinsIcon}>
          <span className="text-sm font-medium tabular-nums">
            {formatWage(contract)}
          </span>
        </RecordField>
        <RecordField type="static" label="Structure" icon={FileTextIcon}>
          <span className="text-sm break-words">
            {structure ? <Link className="hover:text-primary" href={'/payroll/structures?record=' + encodeURIComponent(structure.id)}>{structure.name}</Link> : contract.salaryStructure}
          </span>
        </RecordField>
        <RecordField type="static" label="Schedule" icon={ClockIcon}>
          <span className="text-sm break-words">
            {schedule ? <Link className="hover:text-primary" href={'/attendance/schedules/' + schedule.id}>{schedule.name}</Link> : contract.workingSchedule || 'Use employee schedule'}
          </span>
        </RecordField>
        <p className="text-muted-foreground pt-2 text-xs leading-relaxed">
          Payroll uses the contract that applies to the selected pay period.
        </p>
      </RecordGroup>
      <Collapsible className="group/metadata">
        <CollapsibleTrigger className="text-muted-foreground flex h-7 w-full items-center justify-between text-xs">
          Record details
          <ChevronDownIcon className="size-3.5 group-data-open/metadata:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 pt-1">
          <RecordField type="static" label="Created" icon={CalendarIcon}>
            <span className="text-sm">
              {formatContractDate(contract.createdAt.slice(0, 10))}
            </span>
          </RecordField>
          <RecordField type="static" label="Created by" icon={UserIcon}>
            <UserChip userId={contract.createdById} />
          </RecordField>
          <RecordField type="static" label="Last update" icon={CalendarIcon}>
            <span className="text-sm">
              {formatContractDate(contract.updatedAt.slice(0, 10))}
            </span>
          </RecordField>
          <RecordField type="static" label="Updated by" icon={UserIcon}>
            <UserChip userId={contract.updatedById} />
          </RecordField>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
