// Component Imports
import { Avatar, AvatarFallback, AvatarImage } from '@/features/nexacrm/components/ui/avatar'

// Util Imports
import { cn, getInitials } from '@/features/nexacrm/lib/utils'

const PersonAvatar = ({
  name,
  src,
  size = 'sm',
  className,
  fallbackClassName
}: {
  name: string
  src?: string
  size?: 'sm' | 'default' | 'lg'
  className?: string
  fallbackClassName?: string
}) => (
  <Avatar key={src ?? ''} size={size} className={cn('shrink-0', className)}>
    {src ? <AvatarImage src={src} alt={name} /> : null}
    <AvatarFallback className={fallbackClassName}>{getInitials(name)}</AvatarFallback>
  </Avatar>
)

export default PersonAvatar
