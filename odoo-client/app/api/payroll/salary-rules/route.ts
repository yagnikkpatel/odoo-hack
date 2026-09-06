import {
  handlePayrollRequest,
  payrollListPath,
} from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, {
    path: () => payrollListPath('salary-rules', request),
  })
}

export async function POST(request: Request) {
  return handlePayrollRequest(request, {
    path: () => '/payroll/salary-rules',
    body: 'rule:create',
  })
}
