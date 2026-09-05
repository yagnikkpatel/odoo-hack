import { handleEmployeeRequest } from '@/features/employees/server'

export async function GET(request: Request) {
  return handleEmployeeRequest(request, { path: () => '/employees/accounts' })
}
