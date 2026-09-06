'use client'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { usePayrollPage, PayrollPagination } from '../components/pagination'
import { downloadPayslipPdf } from '../documents'
import type { Payrun } from '../types'
import { TableSearch } from '@/features/nexacrm/components/data-table/table-search'
import { ArrowLeftIcon, TriangleAlertIcon, PrinterIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Card } from '@/features/nexacrm/components/ui/card'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/features/nexacrm/components/ui/table'
import { PAYRUN_STATUSES, money, type PayrollStatus, type PayrollWarning, type Payslip } from '../types'
export function Status({status}:{status:PayrollStatus}) { return <Badge variant="outline" className={status==='paid'?'border-emerald-500/30 bg-emerald-500/10 text-emerald-700':status==='validated'?'border-violet-500/30 bg-violet-500/10 text-violet-700':''}>{PAYRUN_STATUSES[status]}</Badge> }
export function Heading({title,back,children}:{title:string;back?:string;children?:ReactNode}) { return <div className="flex flex-wrap items-center gap-3 border-b py-3">{back&&<Button size="icon-sm" variant="ghost" aria-label="Go back" render={<Link href={back}/>}><ArrowLeftIcon/></Button>}<h1 className="flex-1 text-base font-semibold tracking-tight">{title}</h1>{children}</div> }
export function AccessDenied(){return <div className="py-16 text-center text-sm text-muted-foreground">Your role does not have access to payroll.</div>}
export function Warnings({warnings}:{warnings:PayrollWarning[]}) { if(!warnings.length)return null; return <Card className="gap-3 border-amber-500/30 bg-amber-500/5 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><TriangleAlertIcon className="size-4 text-amber-600"/>Payroll warnings</h2><ul className="space-y-2 text-sm">{warnings.map((warning,index)=><li key={`${warning.code}-${index}`} className="flex flex-wrap items-start gap-2"><Badge variant="outline">{warning.blocking?'Needs resolution':'Review'}</Badge><span className="flex-1">{warning.message}</span></li>)}</ul></Card> }
export function SlipTable({slips,searchable=true}:{slips:Payslip[];searchable?:boolean}) {const [search,setSearch]=useState('');const filtered=slips.filter(slip=>`${slip.employeeName} ${slip.employeeEmail} ${slip.structureName} ${slip.startDate} ${slip.endDate} ${PAYRUN_STATUSES[slip.status]}`.toLowerCase().includes(search.trim().toLowerCase()));const page=usePayrollPage(filtered,search+'|'+slips.length+'|'+slips[0]?.id);return <>{searchable&&<div className="flex items-center justify-end border-b p-3"><TableSearch value={search} onValueChange={setSearch} placeholder="Search payslips…"/></div>}<Table><TableHeader><TableRow>{['Employee','Period','Structure','Status','Worked days','Gross','Net'].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{page.items.map(slip=><TableRow key={slip.id}><TableCell><Link className="font-medium hover:underline" href={`/payslips/${slip.id}`}>{slip.employeeName}</Link>{slip.warnings.length>0&&<span className="ml-2 text-xs text-amber-700">{slip.warnings.length} warning{slip.warnings.length!==1?'s':''}</span>}</TableCell><TableCell>{slip.startDate} – {slip.endDate}</TableCell><TableCell>{slip.structureName}</TableCell><TableCell><Status status={slip.status}/></TableCell><TableCell>{slip.workedDays} / {slip.expectedDays}</TableCell><TableCell>{money(slip.gross,slip.currency)}</TableCell><TableCell className="font-medium">{money(slip.net,slip.currency)}</TableCell></TableRow>)}{!filtered.length&&<TableRow><TableCell colSpan={7} className="py-14 text-center text-muted-foreground">No payslips to display.</TableCell></TableRow>}</TableBody></Table><PayrollPagination {...page} noun="payslip"/></>}

export function PayslipPdfButton({ slip }: { slip: Payslip }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return <><Button size="icon-sm" variant="ghost" aria-label="Print payslip" disabled={pending || slip.status === 'draft'} onClick={async () => {
    setPending(true); setError(null)
    try {
      const run: Payrun = { id: slip.payrunId, name: slip.payrunName || 'Payrun', structureId: slip.structureId, structureName: slip.structureName, employeeIds: [slip.employeeId], startDate: slip.startDate, endDate: slip.endDate, status: slip.status, createdAt: '', warnings: [] }
      await downloadPayslipPdf(slip, run)
    } catch { setError('Could not generate PDF. Please retry.') } finally { setPending(false) }
  }}><PrinterIcon/></Button>{error && <span role="alert" className="text-xs text-destructive">{error}</span>}</>
}
