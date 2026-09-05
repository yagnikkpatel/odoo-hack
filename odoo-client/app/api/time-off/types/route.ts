import { handleTimeOffRequest } from '@/features/time-off/server'

export async function GET(request: Request) {
  return handleTimeOffRequest(request, { path: () => '/time-off/types' })
}
export async function POST(request: Request) {
  return handleTimeOffRequest(request, { path: () => '/time-off/types', body: 'type-create' })
}
