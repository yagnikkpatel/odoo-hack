'use client'

import { useId, useState } from 'react'
import { Building2Icon } from 'lucide-react'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/features/nexacrm/components/ui/popover'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { buildBlankCompanyInput } from '@/features/nexacrm/types/apps/company-types'
import { useEmployeesStore } from '../store'
import type { Employee } from '../types'

const COMPANY_LOGO = '/images/companies/odoo.png'

export default function EmployeeCompany({ employee }: { employee: Employee }) {
  const companies = useCompaniesStore(state => state.companies)
  const company = companies.find(item => item.id === employee.companyId)
  const { can } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const id = useId()
  const canEdit = can('records:update')
  const assign = (companyId?: string) => useEmployeesStore.getState().updateEmployee(employee.id, { companyId })
  const display = company ? <><CompanyAvatar company={{ name: company.name, logo: COMPANY_LOGO }} /><span className="truncate">{company.name || 'Untitled'}</span></> : <><Building2Icon className="size-4 shrink-0" /><span>Add company</span></>

  if (!canEdit) return <span className="flex items-center gap-2">{company ? display : 'Not set'}</span>

  return (
    <Popover open={open} onOpenChange={value => {
      setOpen(value)
      if (value) { setName(company?.name || '') }
    }}>
      <PopoverTrigger className="flex max-w-full items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted" onClick={event => event.stopPropagation()} aria-label={`Edit company for ${employee.firstName} ${employee.lastName}`}>
        {display}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4" onClick={event => event.stopPropagation()}>
        <PopoverTitle>Company</PopoverTitle>
        <label htmlFor={`${id}-company`}>Select company</label>
        <select id={`${id}-company`} className="h-9 rounded-md border bg-background px-2" value={employee.companyId || ''} onChange={event => {
          const selected = companies.find(item => item.id === event.target.value)
          assign(selected?.id)
          setName(selected?.name || '')
        }}>
          <option value="">No company / Add new</option>
          {companies.map(item => <option key={item.id} value={item.id}>{item.name || 'Untitled'}</option>)}
        </select>
        <label htmlFor={`${id}-name`}>Company name</label>
        <Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} placeholder="Enter company name" />
        <div className="flex items-center gap-2">
          <CompanyAvatar company={{ name: 'Odoo', logo: COMPANY_LOGO }} size="default" />
          <span className="text-muted-foreground text-xs">Company logo</span>
        </div>
        <Button disabled={!name.trim() || (!company && !can('records:create'))} onClick={() => {
          if (company) useCompaniesStore.getState().updateCompany(company.id, { name: name.trim(), logo: COMPANY_LOGO })
          else assign(useCompaniesStore.getState().addCompany({ ...buildBlankCompanyInput(), name: name.trim(), logo: COMPANY_LOGO }))
          setOpen(false)
        }}>{company ? 'Save company' : 'Add company'}</Button>
      </PopoverContent>
    </Popover>
  )
}
