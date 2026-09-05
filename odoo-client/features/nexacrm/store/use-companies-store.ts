// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { ActivityChange } from '@/features/nexacrm/types/apps/activity-types'
import type { Company, CompanyInput, CompanyStatus } from '@/features/nexacrm/types/apps/company-types'
import {
  COMPANY_FIELD_LABELS,
  COMPANY_INDUSTRY_LABELS,
  companyStatusLabel,
  formatCompanyAddress
} from '@/features/nexacrm/types/apps/company-types'

// Store Imports
import { useActivitiesStore } from '@/features/nexacrm/store/use-activities-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { formatCompactCurrency, formatNumber } from '@/features/nexacrm/utils/format'

const buildCompany = (input: CompanyInput): Company => {
  const now = new Date().toISOString()
  const actorId = getActorId()

  return {
    createdById: actorId,
    updatedById: actorId,
    ...input,
    id: `cmp_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now
  }
}

type CompaniesData = {
  companies: Company[]
  hasHydrated: boolean
}

type CompaniesActions = {
  initialize: (companies: Company[]) => void
  addCompany: (input: CompanyInput) => string

  addCompanies: (inputs: CompanyInput[]) => void
  updateCompany: (id: string, input: Partial<CompanyInput>) => void
  deleteCompany: (id: string) => void
  deleteCompanies: (ids: string[]) => void
}

export type CompaniesStore = CompaniesData & CompaniesActions

const formatChangeValue = (field: keyof Company, value: Company[keyof Company]): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined

  if (field === 'address') return formatCompanyAddress({ address: value as Company['address'] }) || undefined

  if (field === 'status') return companyStatusLabel(value as CompanyStatus)
  if (field === 'industry') return COMPANY_INDUSTRY_LABELS[value as keyof typeof COMPANY_INDUSTRY_LABELS]
  if (field === 'icp') return value ? 'ICP' : 'Standard account'
  if (field === 'arr') return formatCompactCurrency(value as number)
  if (field === 'employees') return formatNumber(value as number)
  if (field === 'accountOwnerId') return useUsersStore.getState().users.find(user => user.id === value)?.name

  return String(value)
}

const logFieldChanges = (before: Company, input: Partial<CompanyInput>) => {
  const changes: ActivityChange[] = []

  for (const key of Object.keys(input) as (keyof CompanyInput)[]) {
    const label = COMPANY_FIELD_LABELS[key]

    if (!label || before[key] === input[key]) continue

    changes.push({ label, value: formatChangeValue(key, input[key]) })
  }

  if (changes.length === 0) return

  const name = 'name' in input && input.name ? input.name : before.name

  useActivitiesStore.getState().addActivity({
    entityType: 'company',
    entityId: before.id,
    type: 'status',
    actorId: getActorId(),
    verb: `updated ${changes.length} ${changes.length === 1 ? 'field' : 'fields'} on`,
    subject: name || 'Untitled',
    changes
  })
}

export const useCompaniesStore = create<CompaniesStore>()((set, get) => ({
  companies: [],
  hasHydrated: false,

  initialize: companies => set({ companies, hasHydrated: true }),

  addCompany: input => {
    const company = buildCompany(input)

    set(state => ({ companies: [company, ...state.companies] }))

    return company.id
  },

  addCompanies: inputs => set(state => ({ companies: [...inputs.map(buildCompany), ...state.companies] })),

  updateCompany: (id, input) => {
    const before = get().companies.find(company => company.id === id)

    set(state => ({
      companies: state.companies.map(company =>
        company.id === id
          ? { ...company, ...input, updatedById: getActorId(), updatedAt: new Date().toISOString() }
          : company
      )
    }))

    if (before) logFieldChanges(before, input)
  },

  deleteCompany: id => set(state => ({ companies: state.companies.filter(company => company.id !== id) })),

  deleteCompanies: ids => set(state => ({ companies: state.companies.filter(company => !ids.includes(company.id)) }))
}))

export const useCompany = (id?: string): Company | undefined =>
  useCompaniesStore(state => (id ? state.companies.find(company => company.id === id) : undefined))

export const useCompanyNavigation = (id: string) => {
  const companies = useCompaniesStore(state => state.companies)

  return useMemo(() => {
    const index = companies.findIndex(company => company.id === id)

    return {
      index,
      total: companies.length,
      previousId: index > 0 ? companies[index - 1].id : undefined,
      nextId: index >= 0 && index < companies.length - 1 ? companies[index + 1].id : undefined
    }
  }, [companies, id])
}
