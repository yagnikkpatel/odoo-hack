import {
  contractPath,
  handleContractRequest,
} from '@/features/contracts/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleContractRequest(request, { path: () => contractPath(id) })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleContractRequest(request, {
    path: () => contractPath(id),
    body: 'update',
  })
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleContractRequest(request, { path: () => contractPath(id) })
}
