import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/nexacrm/components/ui/card'
import { cn } from '@/features/nexacrm/lib/utils'

type Props = {
  title: string
  description: string
  className?: string
  contentClassName?: string
}

/** Keeps the existing dashboard grid while real analytics integrations are pending. */
export default function PendingAnalyticsCard({ title, description, className, contentClassName }: Props) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='text-lg font-semibold'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn('flex flex-1 items-center justify-center', contentClassName)}>
        <p className='text-muted-foreground text-center text-sm'>Data connection pending</p>
      </CardContent>
    </Card>
  )
}
