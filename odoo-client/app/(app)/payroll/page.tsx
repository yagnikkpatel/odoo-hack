import type { Metadata } from 'next'
import PayrunsView from '@/features/payroll/operations/payruns'
export const metadata: Metadata = { title: 'Payruns' }
export default function Page(){return <PayrunsView/>}
