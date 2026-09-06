import {
  handlePayrollRequest,
  payrollListPath,
} from '@/features/payroll/server'

export async function GET(request: Request) {
  return handlePayrollRequest(request, {
    path: () => payrollListPath('payruns', request),
  })
}

export async function POST(request: Request) {
  return handlePayrollRequest(request, {
    path: () => '/payroll/payruns',
    body: 'payrun:create',
  })
}
