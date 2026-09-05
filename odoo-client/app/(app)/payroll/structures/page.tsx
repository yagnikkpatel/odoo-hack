import type { Metadata } from 'next'
import { Suspense } from 'react'
import PayrollConfiguration from '@/features/payroll/configuration'
export const metadata: Metadata = { title: 'Salary structures', description: 'Organize the salary rules used by payruns.' }
export default function SalaryStructuresPage() { return <Suspense fallback={<div role="status" className="text-muted-foreground py-8 text-sm">Loading salary structures…</div>}><PayrollConfiguration kind="structures" /></Suspense> }
