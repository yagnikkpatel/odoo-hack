import { handlePayrollRequest, payrollBankPath } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ employeeId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { employeeId } = await context.params
  return handlePayrollRequest(request, { path: () => payrollBankPath(employeeId) })
}
export async function PUT(request: Request, context: RouteContext) {
  const { employeeId } = await context.params
  return handlePayrollRequest(request, { path: () => payrollBankPath(employeeId), body: 'bank' })
}
