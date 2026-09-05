// Payroll requires a complete period, never a page of directory results.
export type PayrollAttendanceInput = {
  employeeId: string
  checkIn: string
  checkOut?: string
  breakMinutes: number
  corrections: unknown[]
}

export const payrollAttendanceInputs: PayrollAttendanceInput[] = []

export function workedMinutes(record: PayrollAttendanceInput) {
  if (!record.checkOut) return undefined
  return (
    (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) /
      60_000 -
    record.breakMinutes
  )
}
