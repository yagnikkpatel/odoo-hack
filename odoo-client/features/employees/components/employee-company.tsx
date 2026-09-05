import { Building2Icon } from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/features/nexacrm/components/ui/avatar'
import type { Employee } from '../types'

/** Company details come from the employee profile, not the CRM demo company store. */
export default function EmployeeCompany({ employee }: { employee: Employee }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Avatar key={employee.companyImage || ''} size="sm">
        {employee.companyImage && (
          <AvatarImage src={employee.companyImage} alt="Company logo" />
        )}
        <AvatarFallback>
          <Building2Icon className="text-muted-foreground size-3.5" />
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{employee.companyName || 'Not set'}</span>
    </span>
  )
}
