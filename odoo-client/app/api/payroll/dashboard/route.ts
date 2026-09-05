import { handlePayrollRequest, payrollQueryPath } from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, {
    path: () => payrollQueryPath(request, '/payroll/dashboard', ['from', 'to', 'department', 'employmentType'])
  })
}
