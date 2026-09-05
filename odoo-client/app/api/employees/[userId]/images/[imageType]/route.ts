import { employeeImagePath, handleEmployeeRequest } from '@/features/employees/server'

type RouteContext = { params: Promise<{ userId: string; imageType: string }> }

export async function DELETE(request: Request, context: RouteContext) {
  const { userId, imageType } = await context.params
  return handleEmployeeRequest(request, { path: () => employeeImagePath(userId, imageType) })
}
