'use client'

import Link from 'next/link'
import { FileTextIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'

export default function EmployeeContractsLink({
  employeeId,
}: {
  employeeId: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="justify-start"
      render={
        <Link href={`/contracts?employee=${encodeURIComponent(employeeId)}`} />
      }
    >
      <FileTextIcon />
      <span>Contracts</span>
    </Button>
  )
}
