import { handleAttendanceRequest } from '@/features/attendance/server'

export async function GET(request: Request) {
  return handleAttendanceRequest(request, { path: () => '/attendance/me/today' })
}
