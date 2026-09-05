type EmployeeSummaryValues = {
  total?: number
  departments?: number
  active?: number
  withManager?: number
  withoutManager?: number
}

// These are server aggregates for the whole directory, not current-page counts.
export function employeeStats(summary: EmployeeSummaryValues) {
  return {
    total: summary.total ?? 0,
    departments: summary.departments ?? 0,
    active: summary.active ?? 0,
    withManager: summary.withManager ?? 0,
    withoutManager: summary.withoutManager ?? 0,
  }
}
