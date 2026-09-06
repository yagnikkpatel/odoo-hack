import { handlePayrollRequest, payrollId } from '@/features/payroll/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, {
    path: () => `/payroll/payruns/${payrollId(id)}`,
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, {
    path: () => `/payroll/payruns/${payrollId(id)}`,
    body: 'payrun:update',
  })
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handlePayrollRequest(request, {
    path: () => `/payroll/payruns/${payrollId(id)}`,
  })
}
