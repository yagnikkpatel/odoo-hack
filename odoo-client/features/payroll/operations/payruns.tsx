'use client'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'
import { useState } from 'react'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { TableSearch } from '@/features/nexacrm/components/data-table/table-search'
import { Card } from '@/features/nexacrm/components/ui/card'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/features/nexacrm/components/ui/table'
import { Choice } from '@/features/hr/components/form'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { formatRecordCount } from '@/features/nexacrm/lib/record-count'
import { usePayrollStore } from '../store'
import { usePayrollPermissions } from '../permissions'
import { PAYRUN_STATUSES } from '../types'
import { Heading, Status, AccessDenied } from './shared'
import PayrunWizard from './wizard'
export default function PayrunsView(){
 const runs=usePayrollStore(s=>s.payruns);const {canReadPayruns,canReadPayslips,canCreatePayrun}=usePayrollPermissions();const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const [status,setStatus]=useState('all');const filtered=runs.filter(r=>(status==='all'||r.status===status)&&`${r.name} ${r.structureName} ${r.startDate} ${r.endDate} ${r.employeeIds.length} ${PAYRUN_STATUSES[r.status]} ${new Date(r.createdAt).toLocaleDateString()}`.toLowerCase().includes(search.trim().toLowerCase()))
 if(!canReadPayruns)return <AccessDenied/>
 return <div className="flex min-h-full flex-col"><Heading title="Payruns">{canReadPayslips&&<Button variant="outline" size="sm" render={<Link href="/payslips"/>}>Payslips</Button>}{canCreatePayrun&&<Button size="sm" onClick={()=>setOpen(true)}><PlusIcon/>New payrun</Button>}</Heading><div className={PAGE_BODY}><DataConnectionNotice /><div className="flex flex-wrap items-center gap-3"><TableSearch className="w-full sm:w-64" placeholder="Search payruns…" value={search} onValueChange={setSearch}/><div className="w-40"><Choice id="payrun-status" value={status} onChange={setStatus} options={[{value:'all',label:'All statuses'},...Object.entries(PAYRUN_STATUSES).map(([value,label])=>({value,label}))]}/></div></div><Card className="gap-0 overflow-hidden py-0"><Table><TableHeader><TableRow>{['Run name','Salary structure','Period','Employees','Status','Created'].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{filtered.map(run=><TableRow key={run.id}><TableCell><Link className="font-medium hover:underline" href={`/payroll/${run.id}`}>{run.name}</Link></TableCell><TableCell>{run.structureName}</TableCell><TableCell>{run.startDate} – {run.endDate}</TableCell><TableCell>{run.employeeIds.length}</TableCell><TableCell><Status status={run.status}/></TableCell><TableCell>{new Date(run.createdAt).toLocaleDateString()}</TableCell></TableRow>)}{!filtered.length&&<TableRow><TableCell colSpan={6} className="py-16 text-center"><p className="font-medium">{runs.length?'No matching payruns':'No payruns to show'}</p><p className="mt-1 text-sm text-muted-foreground">{runs.length?'Try a different search or status.':'Payruns will appear after the data connection is configured.'}</p>{canCreatePayrun&&!runs.length&&<Button className="mt-4" size="sm" onClick={()=>setOpen(true)}><PlusIcon/>New payrun</Button>}</TableCell></TableRow>}</TableBody></Table><div className="text-muted-foreground border-t px-4 py-3 text-sm">{formatRecordCount(filtered.length,'payrun')}</div></Card></div>{open&&<PayrunWizard onClose={()=>setOpen(false)}/>}</div>
}
