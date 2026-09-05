import { handleTimeOffRequest, timeOffRequestPath } from '@/features/time-off/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, { path: () => timeOffRequestPath(id) })
}
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, {
    path: () => timeOffRequestPath(id),
    body: 'request-update',
  })
}
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, { path: () => timeOffRequestPath(id) })
}
