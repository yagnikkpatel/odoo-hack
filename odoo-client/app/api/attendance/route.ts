import { attendanceListPath, handleAttendanceRequest } from '@/features/attendance/server'

export async function GET(request: Request) {
  return handleAttendanceRequest(request, { path: () => attendanceListPath(request) })
}
export async function POST(request: Request) {
  return handleAttendanceRequest(request, { path: () => '/attendance', body: 'create' })
}
