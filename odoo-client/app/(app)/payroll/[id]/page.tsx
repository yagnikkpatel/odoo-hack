import type { Metadata } from 'next'
import PayrunDetail from '@/features/payroll/operations/payrun-detail'
export const metadata: Metadata = { title: 'Payrun details' }
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PayrunDetail key={id} id={id}/>}
