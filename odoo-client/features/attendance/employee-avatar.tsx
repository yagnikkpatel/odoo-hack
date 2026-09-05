'use client'

import { useEffect } from 'react'
import { useEmployeesStore } from '@/features/employees/store'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { useAttendancePermissions } from './permissions'

export default function AttendanceEmployeeAvatar({
  employeeId,
  name,
}: {
  employeeId: string
  name: string
}) {
  const { user } = useCurrentUser()
  const { canReadAny } = useAttendancePermissions()
  const allowed = canReadAny || user.id === employeeId
  const employee = useEmployeesStore(
    (state) =>
      state.details[employeeId] ||
      state.employees.find((item) => item.id === employeeId),
  )
  const loadEmployee = useEmployeesStore((state) => state.loadEmployee)

  useEffect(() => {
    if (!allowed || employee) return
    // The employee store shares in-flight requests across repeated rows.
    void loadEmployee(employeeId).catch(() => {})
  }, [allowed, employee, employeeId, loadEmployee])

  return (
    <PersonAvatar
      name={name}
      src={allowed ? employee?.avatar : undefined}
      className="size-6"
    />
  )
}
