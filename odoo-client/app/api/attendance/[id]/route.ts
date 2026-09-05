import { attendancePath, handleAttendanceRequest } from '@/features/attendance/server'

type RouteContext = { params: Promise<{ id: string }> }
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleAttendanceRequest(request, { path: () => attendancePath(id) })
}
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleAttendanceRequest(request, { path: () => attendancePath(id), body: 'update' })
}
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleAttendanceRequest(request, { path: () => attendancePath(id) })
}
