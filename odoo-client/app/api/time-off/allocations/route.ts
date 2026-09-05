import { handleTimeOffRequest } from '@/features/time-off/server'

export async function GET(request: Request) {
  return handleTimeOffRequest(request, { path: () => '/time-off/allocations' })
}
export async function POST(request: Request) {
  return handleTimeOffRequest(request, {
    path: () => '/time-off/allocations',
    body: 'allocation-create',
  })
}
