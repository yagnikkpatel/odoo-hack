import { handlePayrollRequest, payrollRulePath } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, { path: () => payrollRulePath(id) })
}
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, { path: () => payrollRulePath(id), body: 'rule-update' })
}
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, { path: () => payrollRulePath(id) })
}
