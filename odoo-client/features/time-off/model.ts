export type LeaveUnit = 'days' | 'hours'
export type ApprovalPolicy = 'manager' | 'none'
export type PayrollTreatment = 'paid' | 'unpaid'
export type ApprovalStatus = 'pending' | 'approved' | 'refused'
export type RequestStatus = ApprovalStatus | 'cancelled'
export type Result = { ok: true; id: string } | { ok: false; error: string }

export type TimeOffTypeInput = {
  name: string
  code: string
  unit: LeaveUnit
  requiresAllocation: boolean
  approval: ApprovalPolicy
  payroll: PayrollTreatment
  active: boolean
  description: string
}
export type TimeOffType = TimeOffTypeInput & { id: string; createdAt: string; updatedAt: string }
export type AllocationInput = {
  employeeId: string
  typeId: string
  amount: number
  validFrom: string
  validTo: string
  note: string
}
export type Decision = { at: string; actorId?: string; action: string; reason?: string }
export type Allocation = AllocationInput & {
  id: string
  status: ApprovalStatus
  createdAt: string
  updatedAt: string
  history: Decision[]
}
export type RequestInput = {
  employeeId: string
  typeId: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  reason: string
}
export type DayCharge = { date: string; amount: number }
export type Consumption = DayCharge & { allocationId: string }
export type TimeOffRequest = RequestInput & {
  id: string
  unit: LeaveUnit
  duration: number
  charges: DayCharge[]
  consumptions: Consumption[]
  status: RequestStatus
  createdAt: string
  updatedAt: string
  history: Decision[]
}
export type TimeOffData = { types: TimeOffType[]; allocations: Allocation[]; requests: TimeOffRequest[] }
export type Balance = { allocated: number; taken: number; remaining: number; pending: number }
export type RequestPreview = { ok: true; duration: number; unit: LeaveUnit; charges: DayCharge[] } | { ok: false; error: string }

export const UNIT_LABELS: Record<LeaveUnit, string> = { days: 'Days', hours: 'Hours' }
export const APPROVAL_LABELS: Record<ApprovalPolicy, string> = { manager: 'Manager approval', none: 'No approval required' }
export const PAYROLL_LABELS: Record<PayrollTreatment, string> = { paid: 'Paid leave', unpaid: 'Unpaid leave' }
export const STATUS_LABELS: Record<RequestStatus, string> = { pending: 'Pending approval', approved: 'Approved', refused: 'Refused', cancelled: 'Cancelled' }
