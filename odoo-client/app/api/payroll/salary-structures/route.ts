import {
  handlePayrollRequest,
  payrollListPath,
} from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, {
    path: () => payrollListPath('salary-structures', request),
  })
}

export async function POST(request: Request) {
  return handlePayrollRequest(request, {
    path: () => '/payroll/salary-structures',
    body: 'structure:create',
  })
}
