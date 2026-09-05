/**
 * Payroll needs fields the Contracts API does not provide. Keep that future
 * boundary separate instead of inventing values on live contract records.
 */
export type PayrollContractInput = {
  id: string
  name: string
  employeeId: string
  startDate: string
  endDate?: string
  wage: number
  currency: string
  wagePeriod: 'month' | 'year' | 'hour'
  salaryStructure: string
  workingSchedule?: string
  department: string
  state: 'active' | 'draft' | 'cancelled'
}

/** Payroll is disabled until its backend can supply the required contract terms. */
export const payrollContractInputs: PayrollContractInput[] = []

export function payrollContractForPeriod(
  contracts: PayrollContractInput[],
  employeeId: string,
  startDate: string,
  endDate: string,
) {
  const applicable = contracts.filter(
    (contract) =>
      contract.employeeId === employeeId &&
      contract.state === 'active' &&
      contract.startDate <= endDate &&
      (contract.endDate || '9999-12-31') >= startDate,
  )
  if (applicable.length > 1) {
    throw new Error(
      'The period spans multiple contracts. Split the period before calculating payroll.',
    )
  }
  return applicable[0]
}
