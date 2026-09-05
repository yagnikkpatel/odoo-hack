'use client'

// Third-party Imports
import { BuildingIcon, MailIcon } from 'lucide-react'

// Type Imports
import type { Employee } from '@/features/employees/types'
import { employeeName } from '@/features/employees/types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import EmployeeStatusBadge from '../components/status-badge'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const FieldRow = ({
  icon: Icon,
  value,
  placeholder,
}: {
  icon: typeof MailIcon
  value: string
  placeholder: string
}) => (
  <span className="flex min-w-0 items-center gap-1.5">
    <Icon className="text-muted-foreground/70 size-3.5 shrink-0" />
    <span
      className={cn(
        'truncate text-[0.8rem]',
        value ? 'text-foreground/75' : 'text-muted-foreground/45',
      )}
    >
      {value || placeholder}
    </span>
  </span>
)

const EmployeeCard = ({
  employee,
  onOpen,
}: {
  employee: Employee
  onOpen: () => void
}) => {
  return (
    <li>
      <Button
        variant="outline"
        onClick={onOpen}
        className="hover:border-primary/40 dark:hover:border-primary/40 h-auto w-full flex-col items-stretch gap-0 overflow-hidden p-0 text-left font-normal transition-colors"
      >
        <Card className="gap-0 rounded-none border-0 bg-transparent py-0 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4">
            <span className="flex items-start gap-3">
              <PersonAvatar
                name={employeeName(employee)}
                src={employee.avatar}
                className="size-10"
              />

              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    'min-w-0 truncate text-sm font-medium',
                    !employee.firstName &&
                      !employee.lastName &&
                      'text-muted-foreground font-normal',
                  )}
                >
                  {employeeName(employee)}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {employee.jobTitle || 'No job title'}
                </span>
              </span>
            </span>

            <span className="flex flex-col gap-1">
              <FieldRow
                icon={MailIcon}
                value={employee.email}
                placeholder="No email"
              />
            </span>

            <span className="flex items-center gap-2 border-t pt-3">
              <BuildingIcon className="text-muted-foreground/45 size-4 shrink-0" />
              <span className="text-foreground/70 min-w-0 flex-1 truncate text-[0.8rem]">
                {employee.department || 'Department not set'}
              </span>
              <EmployeeStatusBadge status={employee.status} />
            </span>
          </CardContent>
        </Card>
      </Button>
    </li>
  )
}

export default EmployeeCard
