import type { ReactElement } from 'react'

import { Avatar, AvatarFallback } from '@/features/nexacrm/components/ui/avatar'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/features/nexacrm/components/ui/card'

import { cn } from '@/features/nexacrm/lib/utils'

type StatisticsCardProps = {
  icon: ReactElement
  title: string
  time: string
  value: string | null
  changePercentage: number | null
  className?: string
  iconClassName?: string
}

const StatisticsCard = ({
  icon,
  title,
  time,
  value,
  changePercentage,
  className,
  iconClassName
}: StatisticsCardProps) => {
  return (
    <Card className={cn('justify-between', className)}>
      <CardHeader>
        <Avatar size='lg' className='rounded-sm after:border-0'>
          <AvatarFallback
            className={cn('bg-primary/10 text-primary shrink-0 rounded-sm [&>svg]:size-5', iconClassName)}
          >
            {icon}
          </AvatarFallback>
        </Avatar>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col justify-around gap-4'>
        <p className='flex flex-col gap-1'>
          <span className='text-base font-semibold'>{title}</span>
          <span className='text-muted-foreground text-sm'>{time}</span>
          <span className='text-base font-medium'>{value ?? '—'}</span>
        </p>
        {changePercentage === null ? (
          <span className='text-muted-foreground text-sm'>Data connection pending</span>
        ) : (
          <Badge
            className={cn('rounded-sm', {
              'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400': changePercentage > 0,
              'bg-destructive/10 text-destructive': changePercentage < 0
            })}
          >
            {changePercentage > 0 ? '+' : ''}
            {changePercentage}%
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

export default StatisticsCard
