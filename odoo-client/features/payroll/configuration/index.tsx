'use client'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'
import { useMemo, useState } from 'react'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import type { ColumnDef } from '@tanstack/react-table'
import { LayersIcon, ListOrderedIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useRecordsTable } from '@/features/hr/use-records-table'
import RecordsTable from '@/features/hr/components/records-table'
import RecordPanel from '@/features/hr/components/record-panel'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { usePayrollStore } from '../store'
import { usePayrollPermissions } from '../permissions'
import { COMPUTATION_METHODS, RULE_CATEGORIES } from '../types'
import type { SalaryRule } from '../types'
import { RuleEditor, StructureEditor } from './editors'

type ConfigurationRow = { id: string; name: string; code: string; category: string; sequence: number; method: string; computation: string; rules: number; employees: number; status: string }
const RULE_COLUMNS = ['name','code','category','sequence','method','computation','status']
const STRUCTURE_COLUMNS = ['name','rules','employees','status']
const LABELS: Record<string,string> = { name:'Name',code:'Code',category:'Category',sequence:'Sequence',method:'Computation method',computation:'Calculation',rules:'Rules',employees:'Employees',status:'Status' }
const calculation = (rule:SalaryRule) => rule.method === 'fixed' ? rule.amount.toLocaleString('en-IN',{maximumFractionDigits:2}) : rule.method === 'percentage' ? `${rule.percentage}% of ${rule.base}` : rule.formula

export default function PayrollConfiguration({ kind }: { kind:'rules'|'structures' }) {
  const rules = usePayrollStore(state=>state.rules)
  const structures = usePayrollStore(state=>state.structures)
  const permissions = usePayrollPermissions()
  const [selectedId,setSelectedId] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [editor,setEditor] = useState<string|null>(null)
  const isRules = kind === 'rules'
  const columnIds = isRules ? RULE_COLUMNS : STRUCTURE_COLUMNS
  const title = isRules ? 'Salary rules' : 'Salary structures'
  const singular = isRules ? 'salary rule' : 'salary structure'
  const data = useMemo<ConfigurationRow[]>(()=>{
    const base = {code:'',category:'',sequence:0,method:'',computation:'',rules:0,employees:0}
    return isRules ? [...rules].sort((a,b)=>a.sequence-b.sequence).map(rule=>({...base,id:rule.id,name:rule.name,code:rule.code,category:RULE_CATEGORIES[rule.category],sequence:rule.sequence,method:COMPUTATION_METHODS[rule.method],computation:calculation(rule),status:rule.active?'Active':'Inactive'})) : structures.map(structure=>({...base,id:structure.id,name:structure.name,rules:structure.ruleIds.length,employees:0,status:structure.active?'Active':'Inactive'}))
  },[isRules,rules,structures])
  const columns = useMemo<ColumnDef<ConfigurationRow>[]>(()=>[
    ...columnIds.map((key):ColumnDef<ConfigurationRow>=>({accessorKey:key,size:key==='name'?220:key==='computation'?230:140,meta:{label:LABELS[key],textFilter:key==='name'||key==='code'},header:({column})=><DataTableColumnHeader column={column} title={LABELS[key]}/>,cell:({getValue})=>key==='status'?<Badge variant="outline">{String(getValue())}</Badge>:<span className={key==='code'||key==='computation'?'font-mono text-xs':undefined}>{String(getValue())}</span>})),
    {id:'actions',size:48,enableSorting:false,enableHiding:false,cell:({row})=>permissions.canConfigure?<RowActionShell label={singular+' actions'} onEdit={permissions.canConfigure?()=>setEditor(row.original.id):undefined} onDelete={permissions.canConfigure?()=>{
      const store=usePayrollStore.getState()
      const result=isRules?store.removeRule(row.original.id):store.removeStructure(row.original.id)
      if(!result.ok){toast.error(result.error);return}
      setSelectedId(current=>current===row.original.id?null:current);toast.success(isRules?'Salary rule deleted':'Salary structure deleted')
    }:undefined} deleteTitle={'Delete '+singular+'?'} deleteDescription="This removes the configuration. Records used by other payroll configuration or payruns cannot be deleted."/>:null}
  ],[columnIds,isRules,permissions.canConfigure,singular,setSelectedId])
  const table=useRecordsTable({data,columns,columnIds})
  const rule = isRules ? rules.find(item=>item.id===selectedId) : undefined
  const structure = !isRules ? structures.find(item=>item.id===selectedId) : undefined
  const selected = rule || structure
  const editingRule=rules.find(item=>item.id===editor)
  const editingStructure=structures.find(item=>item.id===editor)
  if (!permissions.canRead) return <div className={PAGE_BODY}><DataConnectionNotice /><p className="text-muted-foreground text-sm">Your role does not have access to payroll configuration.</p></div>
  return <div className="flex min-h-full flex-col">
    <RecordViewBar table={table} viewName={title} count={table.getFilteredRowModel().rows.length} icon={isRules?ListOrderedIcon:LayersIcon} searchPlaceholder={'Search '+title.toLowerCase()+'…'} options={<DataTableViewOptions table={table} reorderableColumnIds={columnIds}/>} actions={permissions.canConfigure?<Button size="sm" className={ACCENT_ICON_BUTTON} onClick={()=>setEditor('new')}><PlusIcon/><span className="max-sm:hidden">New {singular}</span><span className="sr-only sm:hidden">New {singular}</span></Button>:undefined}/>
    <div className={PAGE_BODY}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-muted-foreground text-xs">{isRules?'Rules execute in sequence to calculate earnings, deductions and net salary.':'Choose a structure when creating a payrun to apply its salary rules.'}</p></div><RecordsTable table={table} columnIds={columnIds} loading={false} label={title.toLowerCase()} noun={isRules?'salary rule':'salary structure'} onOpen={row=>setSelectedId(row.id)}/></div>
    <RecordPanel title={selected?.name || title} open={!!selected} onClose={()=>setSelectedId(null)}>
      {rule && <div className="space-y-4"><dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">{[['Code',rule.code],['Category',RULE_CATEGORIES[rule.category]],['Sequence',rule.sequence],['Method',COMPUTATION_METHODS[rule.method]],['Calculation',calculation(rule)],['Status',rule.active?'Active':'Inactive']].map(([label,value])=><div key={label}><dt className="text-muted-foreground text-xs">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl><p className="text-muted-foreground text-xs">Rules with a lower sequence run first. Referenced rule codes must precede this rule in the same structure.</p><div className="border-t pt-4"><p className="mb-2 text-sm font-medium">Used in structures</p>{structures.filter(item=>item.ruleIds.includes(rule.id)).map(item=><Badge key={item.id} variant="outline" className="mr-1 mb-1">{item.name}</Badge>)}{!structures.some(item=>item.ruleIds.includes(rule.id))&&<p className="text-muted-foreground text-sm">Not included in a structure yet.</p>}</div></div>}
      {structure && <div className="space-y-4"><p className="text-muted-foreground text-sm">{structure.description || 'No description.'}</p><div className="flex flex-wrap gap-2"><Badge variant="outline">{structure.active?'Active':'Inactive'}</Badge><Badge variant="outline">{structure.ruleIds.length} rules</Badge><Badge variant="outline">{data.find(item=>item.id===structure.id)?.employees || 0} employees</Badge></div><p className="text-muted-foreground text-xs">Employee count reflects active contracts assigned to this structure. Rules below execute in ascending sequence.</p><div className="divide-y rounded-lg border">{rules.filter(item=>structure.ruleIds.includes(item.id)).sort((a,b)=>a.sequence-b.sequence).map(item=><div key={item.id} className="space-y-1 p-3"><div className="flex justify-between gap-2 text-sm"><span>{item.sequence}. {item.name}</span><span className="font-mono text-xs">{item.code}</span></div><p className="text-muted-foreground break-words text-xs">{RULE_CATEGORIES[item.category]} · {calculation(item)}{!item.active?' · Inactive':''}</p></div>)}{!structure.ruleIds.length&&<p className="text-muted-foreground p-3 text-sm">No rules included.</p>}</div></div>}
      {selected && permissions.canConfigure && <Button variant="outline" size="sm" className="mt-4 w-full" onClick={()=>setEditor(selected.id)}>Edit {singular}</Button>}
    </RecordPanel>
    {editor && permissions.canConfigure && (isRules?<RuleEditor key={editor} rule={editingRule} onClose={()=>setEditor(null)} onSaved={id=>{setSelectedId(id);table.setGlobalFilter('')}}/>:<StructureEditor key={editor} structure={editingStructure} onClose={()=>setEditor(null)} onSaved={id=>{setSelectedId(id);table.setGlobalFilter('')}}/>)}
  </div>
}
