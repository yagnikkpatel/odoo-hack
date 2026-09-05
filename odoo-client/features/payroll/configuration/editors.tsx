'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import { Label } from '@/features/nexacrm/components/ui/label'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { usePayrollStore } from '../store'
import { COMPUTATION_METHODS, RULE_CATEGORIES } from '../types'
import { FORMULA_VARIABLES, validateRules } from '../engine'
import type { SalaryRule, SalaryRuleInput, SalaryStructure, SalaryStructureInput } from '../types'

export function RuleEditor({ rule, onClose, onSaved }: { rule?: SalaryRule; onClose: () => void; onSaved: (id: string) => void }) {
  const rules = usePayrollStore(state => state.rules)
  const [draft, setDraft] = useState<SalaryRuleInput>(rule ? { ...rule } : { name: '', code: '', category: 'allowance', sequence: Math.max(0, ...rules.map(item=>item.sequence)) + 10, method: 'fixed', amount: 0, percentage: 0, base: 'BASIC', formula: '', active: true })
  const [error, setError] = useState<string | null>(null)
  const set = (value: Partial<SalaryRuleInput>) => { setDraft(current => ({ ...current, ...value })); setError(null) }
  const earlierCodes = rules.filter(item => item.id !== rule?.id && item.active && item.sequence < draft.sequence).sort((a,b) => a.sequence-b.sequence).map(item => item.code)
  return <EditorDialog title={rule ? 'Edit salary rule' : 'New salary rule'} description="Define a salary component and how it is calculated on payslips." onClose={onClose} error={error} onSubmit={event => {
    event.preventDefault()
    const result = usePayrollStore.getState().saveRule(draft, rule?.id)
    if (!result.ok) { setError(result.error); toast.error(result.error); return }
    toast.success('Salary rule saved'); onSaved(result.id); onClose()
  }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Rule name" id="rule-name"><Input id="rule-name" required value={draft.name} onChange={event => set({ name: event.target.value })} placeholder="House rent allowance" /></FormField>
      <FormField label="Code" id="rule-code"><Input id="rule-code" required value={draft.code} onChange={event => set({ code: event.target.value.toUpperCase() })} placeholder="HRA" pattern="[A-Z][A-Z0-9_]*" title="Start with a letter; use uppercase letters, numbers and underscores." /></FormField>
      <FormField label="Category" id="rule-category"><Choice id="rule-category" value={draft.category} options={Object.entries(RULE_CATEGORIES).map(([value,label])=>({value,label}))} onChange={value => set({category: value as SalaryRuleInput['category']})} /></FormField>
      <FormField label="Execution sequence" id="rule-sequence"><Input id="rule-sequence" required type="number" min="0" step="1" value={Number.isNaN(draft.sequence) ? '' : draft.sequence} onChange={event => set({ sequence: event.target.value === '' ? NaN : Number(event.target.value) })} /></FormField>
      <FormField label="Computation method" id="rule-method"><Choice id="rule-method" value={draft.method} options={Object.entries(COMPUTATION_METHODS).map(([value,label])=>({value,label}))} onChange={value => set({method: value as SalaryRuleInput['method']})} /></FormField>
      {draft.method === 'fixed' && <FormField label="Fixed amount" id="rule-amount"><Input id="rule-amount" required type="number" min="0" step="0.01" value={Number.isNaN(draft.amount) ? '' : draft.amount} onChange={event => set({amount: event.target.value === '' ? NaN : Number(event.target.value)})} /></FormField>}
      {draft.method === 'percentage' && <><FormField label="Percentage (%)" id="rule-percentage"><Input id="rule-percentage" required type="number" min="0" step="0.01" value={Number.isNaN(draft.percentage) ? '' : draft.percentage} onChange={event => set({percentage: event.target.value === '' ? NaN : Number(event.target.value)})} /></FormField><FormField label="Percentage base" id="rule-base"><Input id="rule-base" required value={draft.base} onChange={event => set({base:event.target.value})} placeholder="BASIC" /></FormField></>}
    </div>
    {draft.method === 'formula' && <FormField label="Formula" id="rule-formula"><Input id="rule-formula" required value={draft.formula} onChange={event=>set({formula:event.target.value})} placeholder="BASIC + HRA" className="font-mono" /></FormField>}
    <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-xs text-muted-foreground"><p>Rules execute from the lowest sequence to the highest. A formula or percentage base can reference an earlier rule’s code only when that rule is included in the same salary structure.</p><p>Available inputs: <span className="font-mono">{FORMULA_VARIABLES.join(', ')}</span>. Use arithmetic operators and parentheses.</p><p>Earlier active rule codes: <span className="font-mono">{earlierCodes.join(', ') || 'None'}</span>.</p></div>
    <div className="flex items-center gap-2"><Checkbox id="rule-active" checked={draft.active} onCheckedChange={active=>set({active})}/><Label htmlFor="rule-active">Active rule</Label></div>
  </EditorDialog>
}

export function StructureEditor({ structure, onClose, onSaved }: { structure?: SalaryStructure; onClose: () => void; onSaved: (id: string) => void }) {
  const [draft,setDraft] = useState<SalaryStructureInput>(structure ? {...structure, ruleIds:[...structure.ruleIds]} : {name:'',description:'',active:true,ruleIds:[]})
  const [error,setError] = useState<string|null>(null)
  const [search,setSearch] = useState('')
  const [sequences,setSequences] = useState<Record<string,number>>({})
  const rules = usePayrollStore(state=>state.rules)
  const effectiveRules = rules.map(rule=>({...rule,sequence:sequences[rule.id] ?? rule.sequence}))
  const sortedRules = [...effectiveRules].sort((a,b)=>a.sequence-b.sequence || a.code.localeCompare(b.code))
  const selectedRules = effectiveRules.filter(rule=>draft.ruleIds.includes(rule.id))
  const dependencyError = validateRules(selectedRules.filter(rule=>rule.active))
  const set = (value:Partial<SalaryStructureInput>)=> {setDraft(current=>({...current,...value}));setError(null)}
  return <EditorDialog title={structure ? 'Edit salary structure' : 'New salary structure'} description="Choose the rules that a payrun uses to calculate employee payslips." onClose={onClose} error={error} onSubmit={event=>{
    event.preventDefault()
    const result=usePayrollStore.getState().saveStructure(draft,structure?.id,selectedRules.filter(rule=>Object.hasOwn(sequences,rule.id)))
    if (!result.ok) {setError(result.error);toast.error(result.error);return}
    toast.success('Salary structure saved');onSaved(result.id);onClose()
  }}>
    <FormField label="Structure name" id="structure-name"><Input id="structure-name" required value={draft.name} onChange={event=>set({name:event.target.value})} placeholder="Regular salary"/></FormField>
    <FormField label="Description" id="structure-description"><Input id="structure-description" value={draft.description} onChange={event=>set({description:event.target.value})} placeholder="Monthly salary for permanent employees"/></FormField>
    <div className="space-y-3 border-t pt-4"><div className="flex items-center justify-between"><Label htmlFor="structure-rule-search">Salary rules</Label><Badge variant="outline">{draft.ruleIds.length} selected</Badge></div><p className="text-muted-foreground text-xs">Rules run from the lowest sequence to the highest. Sequence changes are saved together with this structure and apply to every structure using the same rule.</p>
      <Input id="structure-rule-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search rules by name or code…"/>
      <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
        {sortedRules.filter(rule=>(rule.name+' '+rule.code).toLowerCase().includes(search.toLowerCase())).map(rule=><div key={rule.id} className="flex items-center gap-3 p-3"><Checkbox id={'structure-rule-'+rule.id} checked={draft.ruleIds.includes(rule.id)} onCheckedChange={checked=>set({ruleIds:checked ? [...draft.ruleIds,rule.id] : draft.ruleIds.filter(id=>id!==rule.id)})}/><Input aria-label={rule.name+' sequence'} type="number" min="0" step="1" required disabled={!draft.ruleIds.includes(rule.id)} className="w-16 shrink-0 tabular-nums" value={Number.isNaN(rule.sequence)?'':rule.sequence} onChange={event=>{setSequences(current=>({...current,[rule.id]:event.target.value===''?NaN:Number(event.target.value)}));setError(null)}}/><Label htmlFor={'structure-rule-'+rule.id} className="flex min-w-0 flex-1 flex-col items-start gap-1"><span className="truncate">{rule.name}</span><span className="text-muted-foreground text-xs font-normal">{rule.code} · {RULE_CATEGORIES[rule.category]}{!rule.active ? ' · Inactive' : ''}</span></Label></div>)}
        {!sortedRules.some(rule=>(rule.name+' '+rule.code).toLowerCase().includes(search.toLowerCase())) && <p className="text-muted-foreground p-4 text-sm">No matching rules. Create a salary rule from Salary rules.</p>}
      </div>
      {dependencyError && <p role="status" className="text-destructive text-xs">{dependencyError} Include its dependencies, activate missing rules, or adjust the sequence.</p>}
      {selectedRules.some(rule=>!rule.active) && <p className="text-muted-foreground text-xs">Inactive rules are included but will be skipped during payslip calculation.</p>}
    </div><div className="flex items-center gap-2"><Checkbox id="structure-active" checked={draft.active} onCheckedChange={active=>set({active})}/><Label htmlFor="structure-active">Active structure</Label></div>
  </EditorDialog>
}
