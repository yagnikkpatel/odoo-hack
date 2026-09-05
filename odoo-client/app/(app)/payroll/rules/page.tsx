import type { Metadata } from 'next'
import { Suspense } from 'react'
import PayrollConfiguration from '@/features/payroll/configuration'
export const metadata: Metadata = { title: 'Salary rules', description: 'Manage salary computation rules and execution order.' }
export default function SalaryRulesPage() { return <Suspense fallback={<div role="status" className="text-muted-foreground py-8 text-sm">Loading salary rules…</div>}><PayrollConfiguration kind="rules" /></Suspense> }
