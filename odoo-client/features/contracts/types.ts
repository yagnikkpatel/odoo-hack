export const CONTRACT_STATES = {
  draft: 'Draft',
  active: 'Active',
  cancelled: 'Cancelled',
} as const
export const CONTRACT_STATUSES = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
  draft: 'Draft',
  cancelled: 'Cancelled',
} as const
export const WAGE_PERIODS = {
  month: 'Monthly',
  year: 'Annual',
  hour: 'Hourly',
} as const
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const

export type ContractInput = {
  name: string
  employeeId: string
  startDate: string
  endDate?: string
  department: string
  jobPosition: string
  wage: number
  currency: (typeof CURRENCIES)[number]
  wagePeriod: keyof typeof WAGE_PERIODS
  salaryStructure: string
  workingSchedule?: string
  state: keyof typeof CONTRACT_STATES
}
export type Contract = ContractInput & {
  id: string
  createdAt: string
  updatedAt: string
  createdById?: string
  updatedById?: string
}
export type ContractStatus = keyof typeof CONTRACT_STATUSES
export type ContractRow = Contract & {
  employeeName: string
  avatar?: string
  status: ContractStatus
}

export const today = () => {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
export function contractStatus(
  contract: ContractInput,
  date = today(),
): ContractStatus {
  if (contract.state !== 'active') return contract.state
  if (contract.startDate > date) return 'scheduled'
  if (contract.endDate && contract.endDate < date) return 'expired'
  return 'active'
}
export const formatContractDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(date + 'T12:00:00'))
    : 'Ongoing'
export const formatWage = (
  contract: Pick<ContractInput, 'wage' | 'currency' | 'wagePeriod'>,
) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: contract.currency,
    maximumFractionDigits: 2,
  }).format(contract.wage) +
  ' / ' +
  contract.wagePeriod

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
export const datesOverlap = (
  a: Pick<ContractInput, 'startDate' | 'endDate'>,
  b: Pick<ContractInput, 'startDate' | 'endDate'>,
) =>
  a.startDate <= (b.endDate || '9999-12-31') &&
  b.startDate <= (a.endDate || '9999-12-31')

export function validateContract(
  input: ContractInput,
  contracts: Contract[],
  employeeIds: string[],
  editingId?: string,
): string | null {
  if (!input.name.trim()) return 'Enter a contract name.'
  if (!employeeIds.includes(input.employeeId))
    return 'Choose an existing employee.'
  if (!validDate(input.startDate)) return 'Enter a valid start date.'
  if (input.endDate && !validDate(input.endDate))
    return 'Enter a valid end date.'
  if (input.endDate && input.endDate < input.startDate)
    return 'End date cannot be before the start date.'
  if (!input.department.trim() || !input.jobPosition.trim())
    return 'Enter the department and job position.'
  if (!Number.isFinite(input.wage) || input.wage < 0)
    return 'Wage must be a valid, non-negative amount.'
  if (
    !CURRENCIES.includes(input.currency) ||
    !Object.hasOwn(WAGE_PERIODS, input.wagePeriod)
  )
    return 'Choose a supported currency and wage period.'
  if (!input.salaryStructure.trim()) return 'Enter a salary structure.'
  if (!Object.hasOwn(CONTRACT_STATES, input.state))
    return 'Choose a valid contract status.'
  const conflict =
    input.state === 'active' &&
    contracts.find(
      (contract) =>
        contract.id !== editingId &&
        contract.employeeId === input.employeeId &&
        contract.state === 'active' &&
        datesOverlap(contract, input),
    )
  if (conflict)
    return (
      'These dates overlap with "' +
      conflict.name +
      '". End the existing contract before the new one starts, or save this one as a draft.'
    )
  return null
}

/** Period-aware lookup for the future payroll boundary; never substitute today's contract. */
export function contractForPeriod(
  contracts: Contract[],
  employeeId: string,
  startDate: string,
  endDate: string,
): Contract | undefined {
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate)
    throw new Error('Choose a valid payroll period.')
  const applicable = contracts.filter(
    (contract) =>
      contract.employeeId === employeeId &&
      contract.state === 'active' &&
      datesOverlap(contract, { startDate, endDate }),
  )
  if (applicable.length > 1)
    throw new Error(
      'The period spans multiple contracts. Split the period before calculating payroll.',
    )
  return applicable[0]
}
