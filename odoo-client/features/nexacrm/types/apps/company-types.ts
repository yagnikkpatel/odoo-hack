// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'

export const COMPANY_STATUSES = ['prospect', 'engaged', 'customer', 'at_risk', 'churned'] as const

export type CompanyStatus = (typeof COMPANY_STATUSES)[number] | (string & {})

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  engaged: 'Engaged',
  customer: 'Customer',
  at_risk: 'At risk',
  churned: 'Churned'
}

export const COMPANY_STATUS_TONES: Record<string, BadgeTone> = {
  prospect: 'neutral',
  engaged: 'info',
  customer: 'success',
  at_risk: 'warning',
  churned: 'danger'
}

const humanize = (status: string) => status.replace(/[_-]+/g, ' ').replace(/^./, character => character.toUpperCase())

/** Display label for any stage - known or added on the board. */
export const companyStatusLabel = (status: CompanyStatus): string => COMPANY_STATUS_LABELS[status] ?? humanize(status)

/** Badge tone for any stage; a custom one is neutral until someone assigns it a meaning. */
export const companyStatusTone = (status: CompanyStatus): BadgeTone => COMPANY_STATUS_TONES[status] ?? 'neutral'

export const COMPANY_INDUSTRIES = [
  'software',
  'fintech',
  'ecommerce',
  'healthcare',
  'media',
  'manufacturing',
  'education',
  'other'
] as const

export type CompanyIndustry = (typeof COMPANY_INDUSTRIES)[number]

export const COMPANY_INDUSTRY_LABELS: Record<CompanyIndustry, string> = {
  software: 'Software',
  fintech: 'Fintech',
  ecommerce: 'E-commerce',
  healthcare: 'Healthcare',
  media: 'Media',
  manufacturing: 'Manufacturing',
  education: 'Education',
  other: 'Other'
}

export const COMPANY_STATUS_OPTIONS = COMPANY_STATUSES.map(status => ({
  label: COMPANY_STATUS_LABELS[status],
  value: status
}))

export const COMPANY_INDUSTRY_OPTIONS = COMPANY_INDUSTRIES.map(industry => ({
  label: COMPANY_INDUSTRY_LABELS[industry],
  value: industry
}))

export const NO_INDUSTRY = 'none'

export type CompanyAddress = {
  street1?: string
  street2?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
}

export type Company = {
  id: string
  name: string
  domainName: string

  logo?: string
  employees: number

  icp: boolean

  status: CompanyStatus

  industry?: CompanyIndustry
  address?: CompanyAddress

  arr?: number
  linkedinUrl?: string
  xUrl?: string

  accountOwnerId?: string

  createdById?: string
  updatedById?: string
  createdAt: string
  updatedAt: string
}

export type CompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>

export const buildBlankCompanyInput = (): CompanyInput => ({
  name: '',
  domainName: '',
  employees: 0,
  icp: false,
  status: 'prospect'
})

/** Display name for a record whose name has not been filled in yet. */
export const companyDisplayName = (company: Pick<Company, 'name'>) => company.name.trim() || 'Untitled'

export const formatCompanyAddress = (company: Pick<Company, 'address'>): string =>
  [
    company.address?.street1,
    company.address?.street2,
    company.address?.city,
    company.address?.state,
    company.address?.postcode,
    company.address?.country
  ]
    .filter(Boolean)
    .join(', ')

/** Field-by-field labels for the record surface and the CSV columns, in reading order. */
export const COMPANY_ADDRESS_PARTS: { key: keyof CompanyAddress; label: string }[] = [
  { key: 'street1', label: 'Street' },
  { key: 'street2', label: 'Street 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'country', label: 'Country' }
]

export const COMPANY_FIELD_LABELS: Partial<Record<keyof Company, string>> = {
  name: 'Name',
  domainName: 'Domain',
  logo: 'Logo',
  employees: 'Employees',
  arr: 'Annual Revenue',
  icp: 'Segment',
  status: 'Status',
  industry: 'Industry',
  address: 'Address',
  linkedinUrl: 'LinkedIn',
  xUrl: 'X',
  accountOwnerId: 'Account owner'
}
