import {
  contractHistoryPath,
  handleContractRequest,
} from '@/features/contracts/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return handleContractRequest(request, { path: () => contractHistoryPath(id) })
}
