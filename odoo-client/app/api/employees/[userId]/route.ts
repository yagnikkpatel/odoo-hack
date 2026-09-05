import { employeePath, handleEmployeeRequest } from '@/features/employees/server'

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { userId } = await context.params
  return handleEmployeeRequest(request, { path: () => employeePath(userId) })
}

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await context.params
  return handleEmployeeRequest(request, { path: () => employeePath(userId), body: 'profile' })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params
  return handleEmployeeRequest(request, { path: () => employeePath(userId), body: 'profile' })
}

export async function DELETE(request: Request, context: RouteContext) {
  const { userId } = await context.params
  return handleEmployeeRequest(request, { path: () => employeePath(userId) })
}
