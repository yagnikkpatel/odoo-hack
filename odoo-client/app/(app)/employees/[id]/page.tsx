import EmployeeDetail from '@/features/employees/employee-detail'

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // Resolve details from the record store; the API data connection is a separate step.
  return <EmployeeDetail employeeId={id} />
}
