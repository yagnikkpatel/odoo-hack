'use client'

// Third-party Imports
import type { Row, Table } from '@tanstack/react-table'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { formatPersonName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

const PersonRowActions = ({ row, table }: { row: Row<Person>; table: Table<Person> }) => {
  const person = row.original
  const deletePerson = usePeopleStore(state => state.deletePerson)
  const { can } = useCurrentUser()
  const onEditRow = table.options.meta?.onEditRow

  const name = formatPersonName(person)

  return (
    <RowActionShell
      viewHref={`/employees/${person.id}`}
      onEdit={can('records:update') && onEditRow ? () => onEditRow(person) : undefined}
      label={`Actions for ${name}`}
      onDelete={can('records:delete') ? () => deletePerson(person.id) : undefined}
      deleteTitle='Delete person'
      deleteDescription={
        <>
          This will permanently remove <span className='text-foreground font-medium'>{name}</span>. This action cannot
          be undone.
        </>
      }
    />
  )
}

export default PersonRowActions
