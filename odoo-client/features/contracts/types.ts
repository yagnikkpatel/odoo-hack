export const CONTRACT_STATUSES = {
  running: 'Running',
  expired: 'Expired',
} as const

export type ContractStatus = keyof typeof CONTRACT_STATUSES

export type ContractInput = {
  employeeId: string
  startDate: string
  endDate: string
  wage: number
  status: ContractStatus
}

export type ContractUpdateInput = Omit<ContractInput, 'employeeId'>

export type Contract = ContractInput & {
  id: string
  employeeName: string
  employeeEmail: string
  employeeAvatar?: string
  createdAt: string
  updatedAt: string
}

export type ContractListQuery = {
  limit: number
  offset: number
  search?: string
  status?: ContractStatus
  employeeId?: string
}

export type ContractPagination = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export type ContractHistoryAction = 'created' | 'updated' | 'deleted'

export type ContractHistoryFieldChange = {
  old: unknown
  new: unknown
}

export type ContractHistorySnapshot = {
  employeeId: string
  startDate: string
  endDate: string
  wage: number
  status: ContractStatus
}

export type ContractHistoryEntry = {
  id: string
  contractId: string
  employeeId: string
  action: ContractHistoryAction
  changes: Record<string, ContractHistoryFieldChange>
  snapshot: ContractHistorySnapshot
  changedBy: string | null
  changedByName: string | null
  createdAt: string
}

export const CONTRACT_HISTORY_FIELD_LABELS: Record<string, string> = {
  startDate: 'Start date',
  endDate: 'End date',
  wage: 'Wage',
  status: 'Status',
}

export function formatContractHistoryValue(
  field: string,
  value: unknown,
): string {
  if (value === null || value === undefined) return '—'
  if (field === 'wage' && typeof value === 'number') return formatWage(value)
  if ((field === 'startDate' || field === 'endDate') && typeof value === 'string') {
    return formatContractDate(value)
  }
  if (field === 'status' && typeof value === 'string') {
    return CONTRACT_STATUSES[value as ContractStatus] ?? value
  }
  return String(value)
}

export const today = () => {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function contractTitle(contract: Pick<Contract, 'employeeName'>) {
  return `${contract.employeeName} contract`
}

export function formatContractDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

export function formatContractTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

export function formatWage(wage: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(wage)
}

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  )
}

export function validateContract(input: ContractInput): string | null {
  if (!input.employeeId) return 'Choose an employee.'
  if (!validDate(input.startDate)) return 'Enter a valid start date.'
  if (!validDate(input.endDate)) return 'Enter a valid end date.'
  if (input.endDate <= input.startDate)
    return 'End date must be after the start date.'
  if (
    !Number.isFinite(input.wage) ||
    input.wage <= 0 ||
    input.wage > 9_999_999_999.99
  )
    return 'Wage must be greater than 0 and no more than 9,999,999,999.99.'
  if (!Object.hasOwn(CONTRACT_STATUSES, input.status))
    return 'Choose a valid contract status.'
  return null
}
