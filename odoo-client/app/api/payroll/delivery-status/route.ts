import { handlePayrollRequest } from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, { path: () => '/payroll/delivery-status' })
}
