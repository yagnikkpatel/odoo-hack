import EmployeeDetail from '@/features/employees/employee-detail'

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EmployeeDetail employeeId={id} />
}
