'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { LayersIcon, ListOrderedIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import RecordPanel from '@/features/hr/components/record-panel'
import { usePayrollStore } from '../store'
import { usePayrollPermissions } from '../permissions'
import { COMPUTATION_METHODS, RULE_CATEGORIES, calculation } from '../types'
import PayrollListPage, { AccessDenied } from '../components/list-page'
import { RuleEditor, StructureEditor } from './editors'

type ConfigurationRow = {
  id: string
  name: string
  code: string
  category: string
  sequence: number
  method: string
  computation: string
  rules: number
  employees: number
  payruns: number
  status: string
}
const RULE_COLUMNS = ['sequence', 'name', 'code', 'category', 'method', 'computation', 'status']
const STRUCTURE_COLUMNS = ['name', 'rules', 'employees', 'payruns', 'status']
const LABELS: Record<string, string> = {
  name: 'Name',
  code: 'Code',
  category: 'Category',
  sequence: 'Sequence',
  method: 'Method',
  computation: 'Calculation',
  rules: 'Rules',
  employees: 'Employees',
  payruns: 'Payruns',
  status: 'Status'
}

export default function PayrollConfiguration({ kind }: { kind: 'rules' | 'structures' }) {
  const rules = usePayrollStore(state => state.rules)
  const structures = usePayrollStore(state => state.structures)
  const permissions = usePayrollPermissions()
  const [selectedId, setSelectedId] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [editor, setEditor] = useState<string | null>(null)
  const isRules = kind === 'rules'
  const columnIds = isRules ? RULE_COLUMNS : STRUCTURE_COLUMNS
  const title = isRules ? 'Salary rules' : 'Salary structures'
  const singular = isRules ? 'salary rule' : 'salary structure'
  const data = useMemo<ConfigurationRow[]>(() => {
    const base = { code: '', category: '', sequence: 0, method: '', computation: '', rules: 0, employees: 0, payruns: 0 }
    return isRules
      ? rules.map(rule => ({
          ...base,
          id: rule.id,
          name: rule.name,
          code: rule.code,
          category: RULE_CATEGORIES[rule.category],
          sequence: rule.sequence,
          method: COMPUTATION_METHODS[rule.method],
          computation: calculation(rule),
          status: rule.active ? 'Active' : 'Inactive'
        }))
      : structures.map(structure => ({
          ...base,
          id: structure.id,
          name: structure.name,
          rules: structure.ruleCount,
          employees: structure.employeeCount,
          payruns: structure.payrunCount,
          status: structure.active ? 'Active' : 'Inactive'
        }))
  }, [isRules, rules, structures])
  const columns = useMemo<ColumnDef<ConfigurationRow>[]>(
    () => [
      ...columnIds.map(
        (key): ColumnDef<ConfigurationRow> => ({
          accessorKey: key,
          size: key === 'name' ? 220 : key === 'computation' ? 260 : key === 'sequence' ? 100 : 130,
          meta: {
            label: LABELS[key],
            textFilter: key === 'name' || key === 'code',
            filterOptions:
              key === 'status'
                ? [
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' }
                  ]
                : key === 'category'
                  ? Object.values(RULE_CATEGORIES).map(label => ({ value: label, label }))
                  : undefined
          },
          header: ({ column }) => <DataTableColumnHeader column={column} title={LABELS[key]} />,
          filterFn: key === 'status' || key === 'category' ? (row, id, value) => row.getValue(id) === value : undefined,
          cell: ({ getValue }) =>
            key === 'status' ? (
              <Badge variant={getValue() === 'Active' ? 'secondary' : 'outline'}>{String(getValue())}</Badge>
            ) : key === 'name' ? (
              <span className='truncate font-medium'>{String(getValue())}</span>
            ) : (
              <span className={key === 'code' || key === 'computation' ? 'font-mono text-xs' : 'tabular-nums'}>
                {String(getValue())}
              </span>
            )
        })
      ),
      {
        id: 'actions',
        size: 48,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => <span className='sr-only'>Actions</span>,
        cell: ({ row }) =>
          permissions.canConfigure ? (
            <RowActionShell
              label={`${singular} actions`}
              onEdit={() => setEditor(row.original.id)}
              onDelete={async () => {
                const store = usePayrollStore.getState()
                const result = isRules
                  ? await store.removeRule(row.original.id)
                  : await store.removeStructure(row.original.id)
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                setSelectedId(current => (current === row.original.id ? null : current))
                toast.success(isRules ? 'Salary rule deleted' : 'Salary structure deleted')
              }}
              deleteTitle={`Delete ${singular}?`}
              deleteDescription='Configuration referenced by contracts, structures or payruns cannot be deleted; archive it instead.'
            />
          ) : null
      }
    ],
    [columnIds, isRules, permissions.canConfigure, singular, setSelectedId]
  )
  const rule = isRules ? rules.find(item => item.id === selectedId) : undefined
  const structure = !isRules ? structures.find(item => item.id === selectedId) : undefined
  const selected = rule || structure
  const editingRule = rules.find(item => item.id === editor)
  const editingStructure = structures.find(item => item.id === editor)
  if (!permissions.canRead) return <AccessDenied>Your role does not have access to payroll configuration.</AccessDenied>
  return (
    <>
      <PayrollListPage
        title={title}
        icon={isRules ? ListOrderedIcon : LayersIcon}
        data={data}
        columns={columns}
        columnIds={columnIds}
        onOpen={row => setSelectedId(row.id)}
        hint={
          isRules
            ? 'Rules execute in ascending sequence; later rules can reference earlier codes.'
            : 'A payrun applies the rules of the structure chosen in its first step.'
        }
        actions={
          permissions.canConfigure ? (
            <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={() => setEditor('new')}>
              <PlusIcon />
              <span className='max-sm:hidden'>New {singular}</span>
              <span className='sr-only sm:hidden'>New {singular}</span>
            </Button>
          ) : undefined
        }
      />
      <RecordPanel title={selected?.name || title} open={!!selected} onClose={() => setSelectedId(null)}>
        {rule && (
          <div className='space-y-4'>
            <dl className='grid grid-cols-2 gap-x-4 gap-y-4 text-sm'>
              {[
                ['Code', rule.code],
                ['Category', RULE_CATEGORIES[rule.category]],
                ['Sequence', rule.sequence],
                ['Method', COMPUTATION_METHODS[rule.method]],
                ['Calculation', calculation(rule)],
                ['Status', rule.active ? 'Active' : 'Inactive']
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className='text-muted-foreground text-xs'>{label}</dt>
                  <dd className='mt-1 break-words'>{value}</dd>
                </div>
              ))}
            </dl>
            {rule.description && <p className='text-muted-foreground text-sm'>{rule.description}</p>}
            <div className='border-t pt-4'>
              <p className='mb-2 text-sm font-medium'>Used in structures</p>
              {structures
                .filter(item => item.ruleIds.includes(rule.id))
                .map(item => (
                  <Badge key={item.id} variant='outline' className='mr-1 mb-1'>
                    {item.name}
                  </Badge>
                ))}
              {!structures.some(item => item.ruleIds.includes(rule.id)) && (
                <p className='text-muted-foreground text-sm'>Not included in a structure yet.</p>
              )}
            </div>
          </div>
        )}
        {structure && (
          <div className='space-y-4'>
            <p className='text-muted-foreground text-sm'>{structure.description || 'No description.'}</p>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline'>{structure.active ? 'Active' : 'Inactive'}</Badge>
              <Badge variant='outline'>{structure.ruleCount} rules</Badge>
              <Badge variant='outline'>{structure.employeeCount} employees</Badge>
              <Badge variant='outline'>{structure.payrunCount} payruns</Badge>
            </div>
            <p className='text-muted-foreground text-xs'>
              Employee count reflects running contracts assigned to this structure. Rules run in ascending sequence.
            </p>
            <div className='divide-y rounded-lg border'>
              {rules
                .filter(item => structure.ruleIds.includes(item.id))
                .sort((a, b) => a.sequence - b.sequence)
                .map(item => (
                  <div key={item.id} className='space-y-1 p-3'>
                    <div className='flex justify-between gap-2 text-sm'>
                      <span>
                        {item.sequence}. {item.name}
                      </span>
                      <span className='font-mono text-xs'>{item.code}</span>
                    </div>
                    <p className='text-muted-foreground font-mono text-xs break-words'>
                      {RULE_CATEGORIES[item.category]} · {calculation(item)}
                      {!item.active ? ' · Inactive' : ''}
                    </p>
                  </div>
                ))}
              {!structure.ruleIds.length && <p className='text-muted-foreground p-3 text-sm'>No rules included.</p>}
            </div>
          </div>
        )}
        {selected && permissions.canConfigure && (
          <Button variant='outline' size='sm' className='mt-4 w-full' onClick={() => setEditor(selected.id)}>
            Edit {singular}
          </Button>
        )}
      </RecordPanel>
      {editor &&
        permissions.canConfigure &&
        (isRules ? (
          <RuleEditor
            key={editor}
            rule={editingRule}
            onClose={() => setEditor(null)}
            onSaved={id => setSelectedId(id)}
          />
        ) : (
          <StructureEditor
            key={editor}
            structure={editingStructure}
            onClose={() => setEditor(null)}
            onSaved={id => setSelectedId(id)}
          />
        ))}
    </>
  )
}
