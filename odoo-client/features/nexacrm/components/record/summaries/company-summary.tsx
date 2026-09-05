'use client'

// Third-party Imports
import { BriefcaseIcon, CircleDotIcon, DollarSignIcon, GlobeIcon, MapPinIcon, UserIcon, UsersIcon } from 'lucide-react'

// Type Imports
import { COMPANY_INDUSTRY_LABELS, companyStatusLabel, formatCompanyAddress } from '@/features/nexacrm/types/apps/company-types'

// Component Imports
import RecordField from '@/features/nexacrm/components/record/record-field'
import UserChip from '@/features/nexacrm/components/record/user-chip'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'

// Util Imports
import { formatCompactCurrency, formatNumber } from '@/features/nexacrm/utils/format'

const CompanySummary = ({ companyId }: { companyId: string }) => {
  const company = useCompany(companyId)

  if (!company) return <p className='text-muted-foreground text-sm'>This company is no longer available.</p>

  const address = formatCompanyAddress(company)

  return (
    <>
      <RecordField type='static' label='Domain' icon={GlobeIcon}>
        <span className='truncate text-sm'>{company.domainName}</span>
      </RecordField>

      <RecordField type='static' label='Status' icon={CircleDotIcon}>
        <span className='text-sm'>{companyStatusLabel(company.status)}</span>
      </RecordField>

      {company.industry ? (
        <RecordField type='static' label='Industry' icon={BriefcaseIcon}>
          <span className='truncate text-sm'>{COMPANY_INDUSTRY_LABELS[company.industry]}</span>
        </RecordField>
      ) : null}

      <RecordField type='static' label='Employees' icon={UsersIcon}>
        <span className='text-sm tabular-nums'>{formatNumber(company.employees)}</span>
      </RecordField>

      {company.arr ? (
        <RecordField type='static' label='Annual revenue' icon={DollarSignIcon}>
          <span className='text-sm tabular-nums'>{formatCompactCurrency(company.arr)}</span>
        </RecordField>
      ) : null}

      {address ? (
        <RecordField type='static' label='Location' icon={MapPinIcon}>
          <span className='truncate text-sm'>{address}</span>
        </RecordField>
      ) : null}

      <RecordField type='static' label='Account owner' icon={UserIcon}>
        <UserChip userId={company.accountOwnerId} />
      </RecordField>
    </>
  )
}

export default CompanySummary
