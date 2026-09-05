'use client'

// Component Imports
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Store Imports
import { useUser } from '@/features/nexacrm/store/use-users-store'

const UserChip = ({ userId, empty = 'System' }: { userId?: string; empty?: string }) => {
  const user = useUser(userId)

  if (!user) {
    return empty === 'System' ? (
      <span className='bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm'>
        <span className='bg-muted-foreground/20 flex size-4 items-center justify-center rounded-full text-[9px] font-medium'>
          S
        </span>
        System
      </span>
    ) : (
      <span className='text-muted-foreground text-sm'>{empty}</span>
    )
  }

  return (
    <span className='inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm'>
      <PersonAvatar name={user.name} src={user.avatar} className='size-4' fallbackClassName='text-[9px]' />
      <span className='truncate'>{user.name}</span>
    </span>
  )
}

export default UserChip
