import { handlePayrollRequest } from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, { path: () => '/payroll/rules' })
}
export async function POST(request: Request) {
  return handlePayrollRequest(request, { path: () => '/payroll/rules', body: 'rule-create' })
}
