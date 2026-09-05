import { employeePath, handleEmployeeRequest } from '@/features/employees/server'

type RouteContext = { params: Promise<{ userId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await context.params
  return handleEmployeeRequest(request, { path: () => `${employeePath(userId)}/images`, body: 'images' })
}
