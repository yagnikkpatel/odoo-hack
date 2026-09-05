'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import { Label } from '@/features/nexacrm/components/ui/label'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { usePayrollStore } from '../store'
import { COMPUTATION_METHODS, FORMULA_VARIABLES, RULE_CATEGORIES } from '../types'
import type { SalaryRule, SalaryRuleInput, SalaryStructure, SalaryStructureInput } from '../types'

const numberValue = (value: number) => (Number.isNaN(value) ? '' : value)
const parseNumber = (value: string) => (value === '' ? Number.NaN : Number(value))

export function RuleEditor({
  rule,
  onClose,
  onSaved
}: {
  rule?: SalaryRule
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const rules = usePayrollStore(state => state.rules)
  const [draft, setDraft] = useState<SalaryRuleInput>(() =>
    rule
      ? {
          name: rule.name,
          code: rule.code,
          category: rule.category,
          sequence: rule.sequence,
          method: rule.method,
          amount: rule.amount,
          percentage: rule.percentage,
          base: rule.base,
          formula: rule.formula,
          description: rule.description,
          active: rule.active
        }
      : {
          name: '',
          code: '',
          category: 'allowance',
          sequence: Math.max(0, ...rules.map(item => item.sequence)) + 10,
          method: 'fixed',
          amount: 0,
          percentage: 0,
          base: 'BASIC',
          formula: '',
          description: '',
          active: true
        }
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const set = (value: Partial<SalaryRuleInput>) => {
    setDraft(current => ({ ...current, ...value }))
    setError(null)
  }
  const earlierCodes = rules
    .filter(item => item.id !== rule?.id && item.active && item.sequence < draft.sequence)
    .sort((a, b) => a.sequence - b.sequence)
    .map(item => item.code)
  return (
    <EditorDialog
      title={rule ? 'Edit salary rule' : 'New salary rule'}
      description='Define a salary component and how it is calculated on payslips.'
      submitLabel={rule ? 'Save changes' : 'Create rule'}
      pending={pending}
      onClose={onClose}
      error={error}
      onSubmit={async event => {
        event.preventDefault()
        if ([draft.sequence, draft.amount, draft.percentage].some(Number.isNaN)) {
          setError('Enter valid numbers for the sequence and amounts.')
          return
        }
        setPending(true)
        const result = await usePayrollStore.getState().saveRule(draft, rule?.id)
        setPending(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success(rule ? 'Salary rule updated' : 'Salary rule created')
        onSaved(result.id)
        onClose()
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField label='Rule name' id='rule-name'>
          <Input
            id='rule-name'
            required
            autoFocus
            maxLength={120}
            value={draft.name}
            onChange={event => set({ name: event.target.value })}
            placeholder='House rent allowance'
          />
        </FormField>
        <FormField label='Code' id='rule-code'>
          <Input
            id='rule-code'
            required
            value={draft.code}
            onChange={event => set({ code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
            placeholder='HRA'
            className='font-mono'
          />
        </FormField>
        <FormField label='Category' id='rule-category'>
          <Choice
            id='rule-category'
            value={draft.category}
            options={Object.entries(RULE_CATEGORIES).map(([value, label]) => ({ value, label }))}
            onChange={value => set({ category: value as SalaryRuleInput['category'] })}
          />
        </FormField>
        <FormField label='Execution sequence' id='rule-sequence'>
          <Input
            id='rule-sequence'
            required
            type='number'
            min='0'
            step='1'
            value={numberValue(draft.sequence)}
            onChange={event => set({ sequence: parseNumber(event.target.value) })}
          />
        </FormField>
        <FormField label='Computation method' id='rule-method'>
          <Choice
            id='rule-method'
            value={draft.method}
            options={Object.entries(COMPUTATION_METHODS).map(([value, label]) => ({ value, label }))}
            onChange={value => set({ method: value as SalaryRuleInput['method'] })}
          />
        </FormField>
        {draft.method === 'fixed' && (
          <FormField label='Fixed amount (₹)' id='rule-amount'>
            <Input
              id='rule-amount'
              required
              type='number'
              min='0'
              step='0.01'
              value={numberValue(draft.amount)}
              onChange={event => set({ amount: parseNumber(event.target.value) })}
            />
          </FormField>
        )}
        {draft.method === 'percentage' && (
          <>
            <FormField label='Percentage (%)' id='rule-percentage'>
              <Input
                id='rule-percentage'
                required
                type='number'
                min='0'
                step='0.01'
                value={numberValue(draft.percentage)}
                onChange={event => set({ percentage: parseNumber(event.target.value) })}
              />
            </FormField>
            <FormField label='Percentage of' id='rule-base'>
              <Input
                id='rule-base'
                required
                value={draft.base}
                onChange={event => set({ base: event.target.value })}
                placeholder='BASIC'
                className='font-mono'
              />
            </FormField>
          </>
        )}
      </div>
      {draft.method === 'formula' && (
        <FormField label='Formula' id='rule-formula'>
          <Input
            id='rule-formula'
            required
            value={draft.formula}
            onChange={event => set({ formula: event.target.value })}
            placeholder='0.12 * MIN(BASIC, 15000)'
            className='font-mono'
          />
        </FormField>
      )}
      <FormField label='Description' id='rule-description'>
        <Textarea
          id='rule-description'
          rows={2}
          maxLength={500}
          value={draft.description}
          onChange={event => set({ description: event.target.value })}
          placeholder='Shown on the rule list to explain the statutory basis.'
        />
      </FormField>
      <div className='bg-muted/40 text-muted-foreground space-y-1.5 rounded-lg border p-3 text-xs'>
        <p>
          Rules run from the lowest sequence upwards. A formula may use numbers, + − × ÷, parentheses, MIN(), MAX(),
          ROUND() and comparisons such as <span className='font-mono'>(GROSS &lt;= 21000) * 0.0075 * GROSS</span>.
        </p>
        <p>
          Inputs: <span className='font-mono'>{FORMULA_VARIABLES.join(', ')}</span>.
        </p>
        <p>
          Earlier active rule codes: <span className='font-mono'>{earlierCodes.join(', ') || 'None'}</span>.
        </p>
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox id='rule-active' checked={draft.active} onCheckedChange={active => set({ active: Boolean(active) })} />
        <Label htmlFor='rule-active'>Active rule</Label>
      </div>
    </EditorDialog>
  )
}

export function StructureEditor({
  structure,
  onClose,
  onSaved
}: {
  structure?: SalaryStructure
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const rules = usePayrollStore(state => state.rules)
  const [draft, setDraft] = useState<SalaryStructureInput>(() =>
    structure
      ? { name: structure.name, description: structure.description, active: structure.active, ruleIds: [...structure.ruleIds] }
      : { name: '', description: '', active: true, ruleIds: [] }
  )
  const [sequences, setSequences] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const set = (value: Partial<SalaryStructureInput>) => {
    setDraft(current => ({ ...current, ...value }))
    setError(null)
  }
  const effective = rules
    .map(rule => ({ ...rule, sequence: sequences[rule.id] ?? rule.sequence }))
    .sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code))
  const visible = effective.filter(rule => `${rule.name} ${rule.code}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <EditorDialog
      title={structure ? 'Edit salary structure' : 'New salary structure'}
      description='Choose the rules a payrun applies to calculate employee payslips.'
      submitLabel={structure ? 'Save changes' : 'Create structure'}
      pending={pending}
      onClose={onClose}
      error={error}
      onSubmit={async event => {
        event.preventDefault()
        if (!draft.ruleIds.length) {
          setError('Include at least one salary rule.')
          return
        }
        const overrides = Object.entries(sequences)
          .filter(([ruleId]) => draft.ruleIds.includes(ruleId))
          .map(([ruleId, sequence]) => ({ ruleId, sequence }))
        if (overrides.some(item => Number.isNaN(item.sequence) || item.sequence < 0)) {
          setError('Sequences must be whole, non-negative numbers.')
          return
        }
        setPending(true)
        const result = await usePayrollStore.getState().saveStructure({ ...draft, sequences: overrides }, structure?.id)
        setPending(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success(structure ? 'Salary structure updated' : 'Salary structure created')
        onSaved(result.id)
        onClose()
      }}
    >
      <FormField label='Structure name' id='structure-name'>
        <Input
          id='structure-name'
          required
          autoFocus
          maxLength={120}
          value={draft.name}
          onChange={event => set({ name: event.target.value })}
          placeholder='Regular Salary (India)'
        />
      </FormField>
      <FormField label='Description' id='structure-description'>
        <Input
          id='structure-description'
          maxLength={500}
          value={draft.description}
          onChange={event => set({ description: event.target.value })}
          placeholder='Monthly CTC with EPF, ESI and professional tax'
        />
      </FormField>
      <div className='space-y-3 border-t pt-4'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='structure-rule-search'>Salary rules</Label>
          <Badge variant='outline'>{draft.ruleIds.length} selected</Badge>
        </div>
        <p className='text-muted-foreground text-xs'>
          Rules run from the lowest sequence upwards. Sequence edits apply to the rule everywhere it is used.
        </p>
        <Input
          id='structure-rule-search'
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder='Search rules by name or code…'
        />
        <div className='max-h-64 divide-y overflow-y-auto rounded-lg border'>
          {visible.map(rule => (
            <div key={rule.id} className='flex items-center gap-3 p-3'>
              <Checkbox
                id={`structure-rule-${rule.id}`}
                checked={draft.ruleIds.includes(rule.id)}
                onCheckedChange={checked =>
                  set({ ruleIds: checked ? [...draft.ruleIds, rule.id] : draft.ruleIds.filter(id => id !== rule.id) })
                }
              />
              <Input
                aria-label={`${rule.name} sequence`}
                type='number'
                min='0'
                step='1'
                disabled={!draft.ruleIds.includes(rule.id)}
                className='w-16 shrink-0 tabular-nums'
                value={numberValue(rule.sequence)}
                onChange={event => {
                  setSequences(current => ({ ...current, [rule.id]: parseNumber(event.target.value) }))
                  setError(null)
                }}
              />
              <Label htmlFor={`structure-rule-${rule.id}`} className='flex min-w-0 flex-1 flex-col items-start gap-1'>
                <span className='truncate'>{rule.name}</span>
                <span className='text-muted-foreground text-xs font-normal'>
                  {rule.code} · {RULE_CATEGORIES[rule.category]}
                  {!rule.active ? ' · Inactive' : ''}
                </span>
              </Label>
            </div>
          ))}
          {!visible.length && (
            <p className='text-muted-foreground p-4 text-sm'>No matching rules. Create one from Salary rules.</p>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox id='structure-active' checked={draft.active} onCheckedChange={active => set({ active: Boolean(active) })} />
        <Label htmlFor='structure-active'>Active structure</Label>
      </div>
    </EditorDialog>
  )
}
