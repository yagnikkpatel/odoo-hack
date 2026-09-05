import EmployeeDetail from '@/features/employees/employee-detail'

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // The source supports client-created demo IDs, so resolve records from the hydrated store.
  return <EmployeeDetail employeeId={id} />
}
