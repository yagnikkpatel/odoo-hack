import { handlePayrollRequest, payrollQueryPath } from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, {
    path: () => payrollQueryPath(request, '/payroll/payruns', ['status', 'structureId'])
  })
}
export async function POST(request: Request) {
  return handlePayrollRequest(request, { path: () => '/payroll/payruns', body: 'payrun-create' })
}
