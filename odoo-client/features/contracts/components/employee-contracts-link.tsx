'use client'
import Link from 'next/link'
import { FileTextIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { useContractsStore } from '../store'

export default function EmployeeContractsLink({
  employeeId,
}: {
  employeeId: string
}) {
  const count = useContractsStore(
    (state) =>
      state.contracts.filter((contract) => contract.employeeId === employeeId)
        .length,
  )
  return (
    <Button
      variant="outline"
      size="sm"
      className="justify-start"
      render={
        <Link href={'/contracts?employee=' + encodeURIComponent(employeeId)} />
      }
    >
      <FileTextIcon />
      <span>Contracts</span>
      <span className="ml-auto text-xs tabular-nums">{count}</span>
    </Button>
  )
}
