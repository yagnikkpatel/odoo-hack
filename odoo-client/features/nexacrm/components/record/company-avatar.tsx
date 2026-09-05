// Type Imports
import type { Company } from '@/features/nexacrm/types/apps/company-types'

// Component Imports
import { Avatar, AvatarFallback, AvatarImage } from '@/features/nexacrm/components/ui/avatar'

// Util Imports
import { darkVariantOf, invertsInDark } from '@/features/nexacrm/utils/brand-logo'
import { cn, getInitials } from '@/features/nexacrm/lib/utils'

const CompanyAvatar = ({
  company,
  size = 'sm',
  radius = 'sm',
  className,
  fallbackClassName
}: {
  company: Pick<Company, 'name' | 'logo'>

  /** Maps to the Avatar primitive's own scale (`sm` = size-6, `default` = size-8, `lg` = size-10). */
  size?: 'sm' | 'default' | 'lg'

  /** `md` for the larger mark on a record header; `sm` everywhere else. */
  radius?: 'sm' | 'md'
  className?: string
  fallbackClassName?: string
}) => {
  const darkLogo = company.logo ? darkVariantOf(company.logo) : undefined

  return (
    <Avatar
      key={company.logo ?? ''}
      size={size}
      className={cn(
        'shrink-0 bg-transparent after:hidden',
        radius === 'md' ? 'rounded-md *:rounded-md' : 'rounded-sm *:rounded-sm',
        className
      )}
    >
      {company.logo ? (
        <AvatarImage
          src={company.logo}
          alt={company.name}
          className={cn(
            'bg-background object-contain',
            darkLogo && 'dark:hidden',

            invertsInDark(company.logo) && 'dark:invert'
          )}
        />
      ) : null}

      {darkLogo ? (
        <AvatarImage src={darkLogo} alt={company.name} className='bg-background hidden object-contain dark:block' />
      ) : null}

      <AvatarFallback className={cn('bg-muted text-muted-foreground', fallbackClassName)}>
        {getInitials(company.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export default CompanyAvatar
