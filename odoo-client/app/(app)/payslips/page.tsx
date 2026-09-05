import type { Metadata } from 'next'
import PayslipsView from '@/features/payroll/operations/payslips'
export const metadata: Metadata = { title: 'Payslips' }
export default function Page(){return <PayslipsView/>}
