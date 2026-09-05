'use client'

// Third-party Imports
import {
  Building2Icon,
  CalendarIcon,
  CalendarPlusIcon,
  CircleDotIcon,
  DollarSignIcon,
  FlagIcon,
  PercentIcon,
  UserIcon,
  UserPlusIcon,
  UserRoundIcon,
  WaypointsIcon
} from 'lucide-react'

// Type Imports
import type { Opportunity, OpportunityOutcome, OpportunitySource } from '@/features/nexacrm/types/apps/opportunity-types'
import {
  OPPORTUNITY_OUTCOME_LABELS,
  OPPORTUNITY_OUTCOME_OPTIONS,
  OPPORTUNITY_OUTCOME_TONES,
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_SOURCE_OPTIONS,
  opportunityStageLabel,
  opportunityStageTone
} from '@/features/nexacrm/types/apps/opportunity-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'
import { UNASSIGNED_OWNER, toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Separator } from '@/features/nexacrm/components/ui/separator'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import DateTimeField from '@/features/nexacrm/components/record/date-time-field'
import StageBadge from '@/features/nexacrm/components/kanban/stage-badge'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RelatedRecordRow, RelatedRecordSection } from '@/features/nexacrm/components/record/related-record-section'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'

// Store Imports
import { useCompaniesStore, useCompany } from '@/features/nexacrm/store/use-companies-store'
import { useStageOptions } from '@/features/nexacrm/store/create-stages-store'
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'
import { usePeopleStore, usePerson } from '@/features/nexacrm/store/use-people-store'
import { useUser, useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { BADGE_TONES } from '@/features/nexacrm/lib/badge-tone'
import { formatDate } from '@/features/nexacrm/utils/format'

const NO_COMPANY = 'none'
const NO_POINT_OF_CONTACT = 'none'

const OpportunityFields = ({ opportunity, canEdit }: { opportunity: Opportunity; canEdit: boolean }) => {
  const updateOpportunity = useOpportunitiesStore(state => state.updateOpportunity)

  const companies = useCompaniesStore(state => state.companies)
  const people = usePeopleStore(state => state.people)
  const users = useUsersStore(state => state.users)

  const company = useCompany(opportunity.companyId)
  const pointOfContact = usePerson(opportunity.pointOfContactId)
  const owner = useUser(opportunity.ownerId)

  const set = (input: Partial<Opportunity>) => updateOpportunity(opportunity.id, input)

  const companyOptions = [
    { label: 'No company', value: NO_COMPANY },
    ...companies.map(item => ({ label: item.name.trim() || 'Untitled', value: item.id }))
  ]

  const personOptions = [
    { label: 'No point of contact', value: NO_POINT_OF_CONTACT },
    ...people.map(item => ({ label: personDisplayName(item), value: item.id }))
  ]

  const ownerOptions = [{ label: 'Unassigned', value: UNASSIGNED_OWNER }, ...users.map(toUserOption)]

  const stageOptions = useStageOptions(useOpportunityStagesStore)

  return (
    <div className='space-y-4'>
      <RecordGroup title='Deal'>
        <RecordField
          type='number'
          label='Amount'
          icon={DollarSignIcon}
          canEdit={canEdit}
          value={opportunity.amount ? String(opportunity.amount) : ''}
          display={opportunity.amount ? `$${opportunity.amount.toLocaleString('en-US')}` : undefined}
          placeholder='Add an amount'
          validate={raw => (raw === '' || Number(raw) >= 0 ? null : 'Amount cannot be negative.')}
          onCommit={raw => set({ amount: raw === '' ? 0 : Number(raw) })}
        />

        <RecordField
          type='select'
          label='Stage'
          icon={CircleDotIcon}
          canEdit={canEdit}
          value={opportunity.stage}
          options={stageOptions}
          onChange={value => set({ stage: value })}
        >
          <StageBadge
            stagesStore={useOpportunityStagesStore}
            stage={opportunity.stage}
            fallbackLabel={opportunityStageLabel(opportunity.stage)}
            fallbackTone={opportunityStageTone(opportunity.stage)}
          />
        </RecordField>

        <RecordField
          type='select'
          label='Outcome'
          icon={FlagIcon}
          canEdit={canEdit}
          value={opportunity.outcome}
          options={OPPORTUNITY_OUTCOME_OPTIONS}
          onChange={value => set({ outcome: value as OpportunityOutcome })}
        >
          <Badge variant='secondary' className={cn(BADGE_TONES[OPPORTUNITY_OUTCOME_TONES[opportunity.outcome]])}>
            {OPPORTUNITY_OUTCOME_LABELS[opportunity.outcome]}
          </Badge>
        </RecordField>

        <RecordField
          type='number'
          label='Probability'
          icon={PercentIcon}
          canEdit={canEdit}
          value={String(opportunity.probability)}
          display={`${opportunity.probability}%`}
          placeholder='Add a probability'
          validate={raw =>
            raw === '' || (Number(raw) >= 0 && Number(raw) <= 100) ? null : 'Must be between 0 and 100.'
          }
          onCommit={raw => set({ probability: raw === '' ? 0 : Number(raw) })}
        />

        <RecordField
          type='select'
          label='Source'
          icon={WaypointsIcon}
          canEdit={canEdit}
          value={opportunity.source}
          options={OPPORTUNITY_SOURCE_OPTIONS}
          onChange={value => set({ source: value as OpportunitySource })}
        >
          <Badge variant='secondary' className={cn(BADGE_TONES.neutral)}>
            {OPPORTUNITY_SOURCE_LABELS[opportunity.source]}
          </Badge>
        </RecordField>

        <RecordField type='static' label='Close date' icon={CalendarIcon}>
          <DateTimeField
            value={opportunity.closeDate}
            canEdit={canEdit}
            placeholder='Add a close date'
            onChange={next => set({ closeDate: next })}
          />
        </RecordField>
      </RecordGroup>

      <RecordGroup title='Relations'>
        <RecordField
          type='select'
          label='Company'
          icon={Building2Icon}
          canEdit={canEdit}
          value={opportunity.companyId ?? NO_COMPANY}
          options={companyOptions}
          onChange={value => set({ companyId: value === NO_COMPANY ? undefined : value })}
        >
          {company ? (
            <span className='flex min-w-0 items-center gap-2'>
              <CompanyAvatar company={company} className='size-5!' fallbackClassName='text-[10px]' />
              <span className='truncate'>{company.name.trim() || 'Untitled'}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>No company</span>
          )}
        </RecordField>

        <RecordField
          type='select'
          label='Point of Contact'
          icon={UserRoundIcon}
          canEdit={canEdit}
          value={opportunity.pointOfContactId ?? NO_POINT_OF_CONTACT}
          options={personOptions}
          onChange={value => set({ pointOfContactId: value === NO_POINT_OF_CONTACT ? undefined : value })}
        >
          {pointOfContact ? (
            <span className='flex min-w-0 items-center gap-2'>
              <PersonAvatar
                name={personDisplayName(pointOfContact)}
                src={pointOfContact.avatar}
                className='size-5!'
                fallbackClassName='text-[10px]'
              />
              <span className='truncate'>{personDisplayName(pointOfContact)}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>Point of Contact</span>
          )}
        </RecordField>

        <RecordField
          type='select'
          label='Owner'
          icon={UserIcon}
          canEdit={canEdit}
          value={opportunity.ownerId ?? UNASSIGNED_OWNER}
          options={ownerOptions}
          onChange={value => set({ ownerId: value === UNASSIGNED_OWNER ? undefined : value })}
        >
          {owner ? (
            <span className='flex min-w-0 items-center gap-2'>
              <PersonAvatar name={owner.name} src={owner.avatar} className='size-5!' fallbackClassName='text-[10px]' />
              <span className='truncate'>{owner.name}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>Unassigned</span>
          )}
        </RecordField>
      </RecordGroup>

      <RecordGroup title='System'>
        <RecordField type='static' label='Creation date' icon={CalendarPlusIcon}>
          <span className='text-sm'>{formatDate(opportunity.createdAt)}</span>
        </RecordField>
        <RecordField type='static' label='Created by' icon={UserPlusIcon}>
          <UserChip userId={opportunity.createdById} />
        </RecordField>
      </RecordGroup>

      <Separator />

      <RelatedRecordSection
        title='Point of Contact'
        count={pointOfContact ? 1 : 0}
        emptyLabel='No point of contact yet.'
        editable={
          canEdit
            ? {
                options: people.map(item => ({
                  id: item.id,
                  label: personDisplayName(item),
                  icon: (
                    <PersonAvatar
                      name={personDisplayName(item)}
                      src={item.avatar}
                      className='size-5!'
                      fallbackClassName='text-[10px]'
                    />
                  )
                })),
                selectedId: opportunity.pointOfContactId,
                onSelect: pointOfContactId => set({ pointOfContactId }),
                onClear: () => set({ pointOfContactId: undefined }),
                editLabel: 'Change point of contact',
                searchPlaceholder: 'Search people…',
                emptyPickerLabel: 'No people yet.'
              }
            : undefined
        }
      >
        {pointOfContact ? (
          <RelatedRecordRow
            href={`/employees/${pointOfContact.id}`}
            label={personDisplayName(pointOfContact)}
            icon={
              <PersonAvatar
                name={personDisplayName(pointOfContact)}
                src={pointOfContact.avatar}
                className='size-4!'
                fallbackClassName='text-[9px]'
              />
            }
            meta={pointOfContact.jobTitle ? <span className='text-xs'>{pointOfContact.jobTitle}</span> : undefined}
            onUnlink={canEdit ? () => set({ pointOfContactId: undefined }) : undefined}
            unlinkLabel={`Unlink ${personDisplayName(pointOfContact)}`}
          />
        ) : null}
      </RelatedRecordSection>

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
                  label: item.name.trim() || 'Untitled',
                  icon: <CompanyAvatar company={item} className='size-5!' fallbackClassName='text-[10px]' />
                })),
                selectedId: opportunity.companyId,
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
            label={company.name.trim() || 'Untitled'}
            icon={<CompanyAvatar company={company} className='size-4!' fallbackClassName='text-[9px]' />}
            onUnlink={canEdit ? () => set({ companyId: undefined }) : undefined}
            unlinkLabel={`Unlink ${company.name.trim() || 'Untitled'}`}
          />
        ) : null}
      </RelatedRecordSection>

      <Separator />

      <RelatedRecordSection
        title='Owner'
        count={owner ? 1 : 0}
        emptyLabel='Unassigned.'
        editable={
          canEdit
            ? {
                options: users.map(item => ({
                  id: item.id,
                  label: item.name,
                  icon: (
                    <PersonAvatar
                      name={item.name}
                      src={item.avatar}
                      className='size-5!'
                      fallbackClassName='text-[10px]'
                    />
                  )
                })),
                selectedId: opportunity.ownerId,
                onSelect: ownerId => set({ ownerId }),
                onClear: () => set({ ownerId: undefined }),
                editLabel: 'Change owner',
                searchPlaceholder: 'Search members…',
                emptyPickerLabel: 'No members yet.'
              }
            : undefined
        }
      >
        {owner ? (
          <RelatedRecordRow
            label={owner.name}
            icon={
              <PersonAvatar name={owner.name} src={owner.avatar} className='size-4!' fallbackClassName='text-[9px]' />
            }
            onUnlink={canEdit ? () => set({ ownerId: undefined }) : undefined}
            unlinkLabel={`Unassign ${owner.name}`}
          />
        ) : null}
      </RelatedRecordSection>
    </div>
  )
}

export default OpportunityFields
