import { handlePayrollRequest, payrollPayrunPath } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, { path: () => payrollPayrunPath(id) })
}
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, { path: () => payrollPayrunPath(id) })
}
