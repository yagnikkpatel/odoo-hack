import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { CONTRACT_STATUSES, WAGE_PERIODS } from './types'
import type { ContractRow } from './types'

const safe = (value: string | undefined) =>
  value && /^\s*[=+\-@]/.test(value) ? "'" + value : value
export const contractCsvRows = (contracts: ContractRow[]) =>
  contracts.map((contract) => ({
    Contract: safe(contract.name),
    Employee: safe(contract.employeeName),
    'Employee ID': contract.employeeId,
    'Start date': contract.startDate,
    'End date': contract.endDate,
    Department: safe(contract.department),
    'Job position': safe(contract.jobPosition),
    Wage: contract.wage,
    Currency: contract.currency,
    'Wage period': WAGE_PERIODS[contract.wagePeriod],
    'Salary structure': safe(contract.salaryStructure),
    'Working schedule': safe(contract.workingSchedule),
    Status: CONTRACT_STATUSES[contract.status],
  }))
export const downloadContractsCsv = (contracts: ContractRow[]) =>
  downloadCsv('contracts.csv', contractCsvRows(contracts))
