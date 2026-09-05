'use client'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'
import { useState } from 'react'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Card } from '@/features/nexacrm/components/ui/card'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/features/nexacrm/components/ui/table'
import { Choice } from '@/features/hr/components/form'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { usePayrollStore } from '../store'
import { usePayrollPermissions } from '../permissions'
import { PAYRUN_STATUSES } from '../types'
import { Heading, Status, AccessDenied } from './shared'
import PayrunWizard from './wizard'
export default function PayrunsView(){
 const runs=usePayrollStore(s=>s.payruns);const {canRead,canProcess}=usePayrollPermissions();const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const [status,setStatus]=useState('all');const filtered=runs.filter(r=>(status==='all'||r.status===status)&&`${r.name} ${r.structureName} ${r.startDate}`.toLowerCase().includes(search.toLowerCase()))
 if(!canRead)return <AccessDenied/>
 return <div className="flex min-h-full flex-col"><Heading title="Payruns"><Button variant="outline" size="sm" render={<Link href="/payslips"/>}>Payslips</Button>{canProcess&&<Button size="sm" onClick={()=>setOpen(true)}><PlusIcon/>New payrun</Button>}</Heading><div className={PAGE_BODY}><DataConnectionNotice /><div className="flex flex-wrap items-center gap-3"><Input className="max-w-sm" placeholder="Search payruns…" aria-label="Search payruns" value={search} onChange={e=>setSearch(e.target.value)}/><div className="w-40"><Choice id="payrun-status" value={status} onChange={setStatus} options={[{value:'all',label:'All statuses'},...Object.entries(PAYRUN_STATUSES).map(([value,label])=>({value,label}))]}/></div><span className="text-xs text-muted-foreground">{filtered.length} payruns</span></div><Card className="gap-0 overflow-hidden py-0"><Table><TableHeader><TableRow>{['Run name','Salary structure','Period','Employees','Status','Created'].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{filtered.map(run=><TableRow key={run.id}><TableCell><Link className="font-medium hover:underline" href={`/payroll/${run.id}`}>{run.name}</Link></TableCell><TableCell>{run.structureName}</TableCell><TableCell>{run.startDate} – {run.endDate}</TableCell><TableCell>{run.employeeIds.length}</TableCell><TableCell><Status status={run.status}/></TableCell><TableCell>{new Date(run.createdAt).toLocaleDateString()}</TableCell></TableRow>)}{!filtered.length&&<TableRow><TableCell colSpan={6} className="py-16 text-center"><p className="font-medium">{runs.length?'No matching payruns':'No payruns to show'}</p><p className="mt-1 text-sm text-muted-foreground">{runs.length?'Try a different search or status.':'Payruns will appear after the data connection is configured.'}</p>{canProcess&&!runs.length&&<Button className="mt-4" size="sm" onClick={()=>setOpen(true)}><PlusIcon/>New payrun</Button>}</TableCell></TableRow>}</TableBody></Table></Card></div>{open&&<PayrunWizard onClose={()=>setOpen(false)}/>}</div>
}
