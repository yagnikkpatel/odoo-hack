import { handlePayrollDownload, payrollPayslipPath } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollDownload(request, () => payrollPayslipPath(id, 'pdf'))
}
