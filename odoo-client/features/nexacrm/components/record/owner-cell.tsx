'use client'

// Component Imports
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Store Imports
import { useUser } from '@/features/nexacrm/store/use-users-store'

const OwnerCell = ({ ownerId }: { ownerId?: string }) => {
  const owner = useUser(ownerId)

  if (!owner) return <span className='text-muted-foreground'>-</span>

  return (
    <div className='flex items-center gap-2'>
      <PersonAvatar name={owner.name} src={owner.avatar} />
      <span className='truncate'>{owner.name}</span>
    </div>
  )
}

export default OwnerCell
