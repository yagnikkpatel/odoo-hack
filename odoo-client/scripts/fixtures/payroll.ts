// Test-only salary policy fixtures. Never imported by the application.
import type { SalaryRule, SalaryStructure } from '../../features/payroll/types'
const rule = (
  id: string,
  name: string,
  code: string,
  category: SalaryRule['category'],
  sequence: number,
  formula: string
): SalaryRule => ({
  id,
  name,
  code,
  category,
  sequence,
  method: 'formula',
  amount: 0,
  percentage: 0,
  base: 'BASIC',
  formula,
  active: true
})
export const DEFAULT_RULES: SalaryRule[] = [
  rule('rule_basic', 'Basic salary', 'BASIC', 'basic', 10, 'WAGE'),
  { ...rule('rule_hra', 'Housing allowance', 'HRA', 'allowance', 20, ''), method: 'percentage', percentage: 20 },
  rule('rule_gross', 'Gross salary', 'GROSS', 'gross', 30, 'BASIC + HRA'),
  {
    ...rule('rule_deduction', 'Employee contribution', 'DEDUCTION', 'deduction', 40, ''),
    method: 'percentage',
    percentage: 5
  },
  rule('rule_unpaid', 'Unpaid leave', 'UNPAID', 'deduction', 45, 'WAGE * UNPAID_DAYS / PERIOD_DAYS'),
  rule('rule_net', 'Net salary', 'NET', 'net', 50, 'GROSS - DEDUCTION - UNPAID')
]
export const DEFAULT_STRUCTURES: SalaryStructure[] = [
  {
    id: 'structure_regular',
    name: 'Regular salary',
    description:
      'Monthly salary, housing allowance, employee contribution and unpaid leave. Illustrative rates; configure your company policy.',
    active: true,
    ruleIds: DEFAULT_RULES.map(rule => rule.id)
  }
]
