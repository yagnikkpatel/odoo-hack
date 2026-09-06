import {
  employeeContractHistoryPath,
  handleContractRequest,
} from '@/features/contracts/server'

type RouteContext = { params: Promise<{ employeeId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { employeeId } = await context.params
  return handleContractRequest(request, {
    path: () => employeeContractHistoryPath(employeeId),
  })
}
