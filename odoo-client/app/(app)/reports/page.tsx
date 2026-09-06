import type { Metadata } from 'next'
import PayrollReports from '@/features/payroll/reporting'
export const metadata: Metadata = { title: 'HR & payroll reports' }
export default function ReportsPage() { return <PayrollReports /> }
