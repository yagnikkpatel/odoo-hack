import { handleAttendanceRequest } from '@/features/attendance/server'

export async function POST(request: Request) {
  return handleAttendanceRequest(request, { path: () => '/attendance/check-out' })
}
