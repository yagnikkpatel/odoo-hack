import type { ColumnFiltersState, PaginationState } from '@tanstack/react-table'
import type { EmployeeListQuery } from '../types'

function filterText(filters: ColumnFiltersState, id: string) {
  const value = filters.find((filter) => filter.id === id)?.value
  if (typeof value === 'string') return value.trim()
  return ''
}

export function employeeListQuery(
  pagination: PaginationState,
  search: string,
  filters: ColumnFiltersState,
): EmployeeListQuery {
  const query: EmployeeListQuery = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  }
  const department = filterText(filters, 'department')
  const role = filterText(filters, 'role')
  if (search.trim()) query.search = search.trim()
  if (department) query.department = department
  if (role) query.role = role
  return query
}

export function employeeQueriesMatch(first: EmployeeListQuery, second: EmployeeListQuery) {
  return first.limit === second.limit
    && first.offset === second.offset
    && first.search === second.search
    && first.department === second.department
    && first.role === second.role
}

export function lastEmployeePage(total: number, pageSize: number) {
  if (total <= 0) return 0
  return Math.floor((total - 1) / pageSize)
}
