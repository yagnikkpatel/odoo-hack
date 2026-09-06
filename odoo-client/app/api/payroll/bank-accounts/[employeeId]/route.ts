import { handlePayrollRequest, payrollId } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ employeeId: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const { employeeId } = await context.params
  return handlePayrollRequest(request, {
    path: () => `/payroll/bank-accounts/${payrollId(employeeId)}`,
    body: 'bank-account',
  })
}
