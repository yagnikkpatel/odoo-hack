import type { Metadata } from 'next'
import PayslipDetail from '@/features/payroll/operations/payslip-detail'
export const metadata: Metadata = { title: 'Payslip details' }
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PayslipDetail key={id} id={id}/>}
