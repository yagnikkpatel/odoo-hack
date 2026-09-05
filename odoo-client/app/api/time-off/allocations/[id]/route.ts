import { handleTimeOffRequest, timeOffAllocationPath } from '@/features/time-off/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, { path: () => timeOffAllocationPath(id) })
}
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, {
    path: () => timeOffAllocationPath(id),
    body: 'allocation-update',
  })
}
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, { path: () => timeOffAllocationPath(id) })
}
