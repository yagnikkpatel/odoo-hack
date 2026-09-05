'use client'

// Third-party Imports
import {
  AtSignIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarPlusIcon,
  LinkIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  StarIcon,
  UserIcon
} from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { UNASSIGNED_OWNER, toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Separator } from '@/features/nexacrm/components/ui/separator'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import RelatedOpportunities from '@/features/nexacrm/components/record/related-opportunities'
import { RelatedRecordRow, RelatedRecordSection } from '@/features/nexacrm/components/record/related-record-section'
import CompanySummary from '@/features/nexacrm/components/record/summaries/company-summary'
import UserChip from '@/features/nexacrm/components/record/user-chip'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useCompaniesStore, useCompany } from '@/features/nexacrm/store/use-companies-store'
import { useOpportunitiesStore, usePersonOpportunities } from '@/features/nexacrm/store/use-opportunities-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUser, useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { formatDate } from '@/features/nexacrm/utils/format'

/** The option value standing in for "works nowhere" - a Select cannot hold undefined. */
const NO_COMPANY = 'none'

const PersonFields = ({ person }: { person: Person }) => {
  const { can } = useCurrentUser()
  const canEdit = can('records:update')

  const updatePerson = usePeopleStore(state => state.updatePerson)
  const users = useUsersStore(state => state.users)
  const companies = useCompaniesStore(state => state.companies)
  const owner = useUser(person.accountOwnerId)
  const company = useCompany(person.companyId)
  const opportunities = usePersonOpportunities(person.id)
  const allOpportunities = useOpportunitiesStore(state => state.opportunities)
  const updateOpportunity = useOpportunitiesStore(state => state.updateOpportunity)

  const set = (input: Partial<Person>) => updatePerson(person.id, input)

  const ownerOptions = [{ label: 'Unassigned', value: UNASSIGNED_OWNER }, ...users.map(toUserOption)]

  const companyOptions = [
    { label: 'No company', value: NO_COMPANY },
    ...companies.map(item => ({ label: item.name || 'Untitled', value: item.id }))
  ]

  return (
    <div className='space-y-4'>
      <RecordGroup title='General'>
        <RecordField
          label='Email'
          icon={MailIcon}
          canEdit={canEdit}
          value={person.email}
          placeholder='Add an email'
          validate={raw => (raw.includes('@') ? null : 'Enter a valid email address.')}
          onCommit={raw => set({ email: raw })}
        />

        <RecordField
          label='Phone'
          icon={PhoneIcon}
          canEdit={canEdit}
          value={person.phone ?? ''}
          placeholder='Add a phone number'
          onCommit={raw => set({ phone: raw || undefined })}
        />

        <RecordField
          label='City'
          icon={MapPinIcon}
          canEdit={canEdit}
          value={person.city ?? ''}
          placeholder='Add a city'
          onCommit={raw => set({ city: raw || undefined })}
        />
        <RecordField
          label='Country'
          icon={MapPinIcon}
          canEdit={canEdit}
          value={person.country ?? ''}
          placeholder='Add a country'
          onCommit={raw => set({ country: raw || undefined })}
        />
        <RecordField
          type='select'
          label='Account owner'
          icon={UserIcon}
          canEdit={canEdit}
          value={person.accountOwnerId ?? UNASSIGNED_OWNER}
          options={ownerOptions}
          onChange={value => set({ accountOwnerId: value === UNASSIGNED_OWNER ? undefined : value })}
        >
          {owner ? (
            <span className='flex min-w-0 items-center gap-2'>
              <PersonAvatar name={owner.name} src={owner.avatar} className='size-5' fallbackClassName='text-[10px]' />
              <span className='truncate'>{owner.name}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>Unassigned</span>
          )}
        </RecordField>
      </RecordGroup>

      <RecordGroup title='Work'>
        <RecordField
          type='select'
          label='Company'
          icon={BuildingIcon}
          canEdit={canEdit}
          value={person.companyId ?? NO_COMPANY}
          options={companyOptions}
          onChange={value => set({ companyId: value === NO_COMPANY ? undefined : value })}
        >
          {company ? (
            <span className='flex min-w-0 items-center gap-2'>
              <CompanyAvatar company={company} />
              <span className='truncate'>{company.name || 'Untitled'}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>No company</span>
          )}
        </RecordField>

        <RecordField
          label='Job title'
          icon={BriefcaseIcon}
          canEdit={canEdit}
          value={person.jobTitle ?? ''}
          placeholder='Add a job title'
          onCommit={raw => set({ jobTitle: raw || undefined })}
        />

        <RecordField
          type='select'
          label='Main contact'
          icon={StarIcon}
          canEdit={canEdit && Boolean(person.companyId)}
          value={person.isPrimary ? 'yes' : 'no'}
          options={[
            { label: 'Main point of contact', value: 'yes' },
            { label: 'Not primary', value: 'no' }
          ]}
          onChange={value => set({ isPrimary: value === 'yes' || undefined })}
        >
          {person.isPrimary ? (
            <Badge variant='secondary'>Primary</Badge>
          ) : (
            <span className='text-muted-foreground'>{person.companyId ? 'Not primary' : 'Needs a company first'}</span>
          )}
        </RecordField>
      </RecordGroup>

      <RecordGroup title='Social'>
        <RecordField
          label='LinkedIn'
          icon={LinkIcon}
          canEdit={canEdit}
          value={person.linkedinUrl ?? ''}
          placeholder='Add a LinkedIn URL'
          onCommit={raw => set({ linkedinUrl: raw || undefined })}
        />
        <RecordField
          label='X'
          icon={AtSignIcon}
          canEdit={canEdit}
          value={person.xUrl ?? ''}
          placeholder='Add an X profile'
          onCommit={raw => set({ xUrl: raw || undefined })}
        />
      </RecordGroup>

      <RecordGroup title='System'>
        <RecordField type='static' label='Created' icon={CalendarPlusIcon}>
          <span className='text-sm'>{formatDate(person.createdAt)}</span>
        </RecordField>
        <RecordField type='static' label='Created by' icon={UserIcon}>
          <UserChip userId={person.createdById} />
        </RecordField>
        <RecordField type='static' label='Last update' icon={CalendarIcon}>
          <span className='text-sm'>{formatDate(person.updatedAt)}</span>
        </RecordField>
        <RecordField type='static' label='Updated by' icon={PencilIcon}>
          <UserChip userId={person.updatedById} />
        </RecordField>
      </RecordGroup>

      <Separator />

      <RelatedRecordSection
        title='Company'
        count={company ? 1 : 0}
        emptyLabel='Not linked to a company yet.'
        editable={
          canEdit
            ? {
                options: companies.map(item => ({
                  id: item.id,
                  label: item.name || 'Untitled',
                  icon: <CompanyAvatar company={item} className='size-5' fallbackClassName='text-[10px]' />
                })),
                selectedId: person.companyId,
                onSelect: companyId => set({ companyId }),
                onClear: () => set({ companyId: undefined }),
                editLabel: 'Change company',
                searchPlaceholder: 'Search companies…',
                emptyPickerLabel: 'No companies yet.'
              }
            : undefined
        }
      >
        {company ? (
          <RelatedRecordRow
            href={`/companies/${company.id}`}
            label={company.name || 'Untitled'}
            icon={<CompanyAvatar company={company} className='size-4' fallbackClassName='text-[9px]' />}
            onUnlink={canEdit ? () => set({ companyId: undefined }) : undefined}
            unlinkLabel={`Unlink ${company.name || 'this company'}`}
          >
            <CompanySummary companyId={company.id} />
          </RelatedRecordRow>
        ) : null}
      </RelatedRecordSection>

      <Separator />

      <RelatedOpportunities
        opportunities={opportunities}
        emptyLabel='Not the point of contact on any opportunity yet.'
        linkable={
          canEdit
            ? {
                available: allOpportunities,
                onLink: id => updateOpportunity(id, { pointOfContactId: person.id }),
                onUnlink: id => updateOpportunity(id, { pointOfContactId: undefined })
              }
            : undefined
        }
      />
    </div>
  )
}

export default PersonFields
