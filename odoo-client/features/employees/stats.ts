import type { Employee } from "./types";

export function employeeStats(employees: readonly Employee[]) {
  const departments = new Set(
    employees
      .map((employee) => employee.department?.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const withManager = employees.filter((employee) => employee.managerId).length;

  return {
    total: employees.length,
    departments,
    withManager,
    withoutManager: employees.length - withManager,
  };
}
