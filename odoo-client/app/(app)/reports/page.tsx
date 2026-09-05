import type { Metadata } from 'next'
import PayrollReports from '@/features/payroll/reporting'
export const metadata: Metadata = { title: 'Payroll dashboard' }
export default function ReportsPage() { return <PayrollReports /> }
