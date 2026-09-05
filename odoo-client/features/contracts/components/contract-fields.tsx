'use client'

import Link from 'next/link'
import {
  CalendarIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CoinsIcon,
  MailIcon,
  UserIcon,
} from 'lucide-react'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/nexacrm/components/ui/collapsible'
import {
  formatContractDate,
  formatContractTimestamp,
  formatWage,
} from '../types'
import type { Contract } from '../types'
import ContractStatusBadge from './status-badge'

export default function ContractFields({ contract }: { contract: Contract }) {
  return (
    <div className="space-y-4">
      <RecordGroup title="Employee">
        <RecordField type="static" label="Employee" icon={UserIcon}>
          <Link
            href={`/employees/${contract.employeeId}`}
            className="hover:text-primary flex min-w-0 items-center gap-2 text-sm"
          >
            <PersonAvatar
              name={contract.employeeName}
              src={contract.employeeAvatar}
              className="size-5"
            />
            <span className="truncate">{contract.employeeName}</span>
          </Link>
        </RecordField>
        <RecordField type="static" label="Email" icon={MailIcon}>
          <a
            href={`mailto:${contract.employeeEmail}`}
            className="hover:text-primary text-sm break-all"
          >
            {contract.employeeEmail}
          </a>
        </RecordField>
        <RecordField type="static" label="Status" icon={CircleCheckIcon}>
          <ContractStatusBadge status={contract.status} />
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
        <RecordField type="static" label="Wage" icon={CoinsIcon}>
          <span className="text-sm font-medium tabular-nums">
            {formatWage(contract.wage)}
          </span>
        </RecordField>
      </RecordGroup>
      <Collapsible className="group/metadata">
        <CollapsibleTrigger className="text-muted-foreground flex h-7 w-full items-center justify-between text-xs">
          Record details
          <ChevronDownIcon className="size-3.5 group-data-open/metadata:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 pt-1">
          <RecordField type="static" label="Created" icon={CalendarIcon}>
            <span className="text-sm">
              {formatContractTimestamp(contract.createdAt)}
            </span>
          </RecordField>
          <RecordField type="static" label="Last update" icon={CalendarIcon}>
            <span className="text-sm">
              {formatContractTimestamp(contract.updatedAt)}
            </span>
          </RecordField>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
