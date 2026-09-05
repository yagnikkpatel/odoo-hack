'use client'

import { ClockIcon } from 'lucide-react'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'

export default function EmployeeTimeline() {
  return (
    <div className="space-y-4">
      <RecordHeading title="Timeline" />
      <DataTableEmptyState
        icon={ClockIcon}
        title="Activity history is not connected"
        description="The employee API does not provide a change history yet. Profile updates are saved to the backend; no activity entries are generated in this browser."
      />
    </div>
  )
}
