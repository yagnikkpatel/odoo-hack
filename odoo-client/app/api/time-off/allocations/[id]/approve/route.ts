import { handleTimeOffRequest, timeOffAllocationPath } from '@/features/time-off/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleTimeOffRequest(request, { path: () => timeOffAllocationPath(id, 'approve') })
}
