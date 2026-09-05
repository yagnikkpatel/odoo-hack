import { handlePayrollRequest, payrollPayrunPath } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, { path: () => payrollPayrunPath(id, 'validate') })
}
