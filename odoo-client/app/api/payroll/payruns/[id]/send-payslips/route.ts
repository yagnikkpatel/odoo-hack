import { handlePayrollRequest, payrollId } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, {
    path: () => `/payroll/payruns/${payrollId(id)}/send-payslips`,
    body: 'payrun:send',
  })
}
