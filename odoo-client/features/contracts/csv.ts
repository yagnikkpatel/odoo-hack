import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { CONTRACT_EMPLOYMENT_TYPES, CONTRACT_STATUSES } from './types'
import type { Contract } from './types'

function safe(value: string) {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value
}

export function contractCsvRows(contracts: Contract[]) {
  return contracts.map((contract) => ({
    'Contract ID': contract.id,
    Employee: safe(contract.employeeName),
    'Employee email': safe(contract.employeeEmail),
    'Employee ID': contract.employeeId,
    'Start date': contract.startDate,
    'End date': contract.endDate,
    Wage: contract.wage,
    Status: CONTRACT_STATUSES[contract.status],
    'Salary structure': contract.salaryStructureName ?? '',
    'Employment type': contract.employmentType
      ? CONTRACT_EMPLOYMENT_TYPES[contract.employmentType]
      : '',
    Created: contract.createdAt,
    Updated: contract.updatedAt,
  }))
}

export function downloadContractsCsv(contracts: Contract[]) {
  downloadCsv('contracts.csv', contractCsvRows(contracts))
}
