import {
  contractListPath,
  handleContractRequest,
} from '@/features/contracts/server'

export async function GET(request: Request) {
  return handleContractRequest(request, {
    path: () => contractListPath(request),
  })
}

export async function POST(request: Request) {
  return handleContractRequest(request, {
    path: () => '/contracts',
    body: 'create',
  })
}
