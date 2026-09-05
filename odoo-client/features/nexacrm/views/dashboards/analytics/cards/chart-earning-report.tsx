'use client'

import type { ReactNode } from 'react'

import { Bar, BarChart, XAxis } from 'recharts'

import { EllipsisVerticalIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/features/nexacrm/components/ui/avatar'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent, CardHeader } from '@/features/nexacrm/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/features/nexacrm/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'

import { cn } from '@/features/nexacrm/lib/utils'
import PendingAnalyticsCard from './pending-card'

const listItems = ['Share', 'Update', 'Refresh']

type Props = {
  title: string
  subTitle: string
  statData: {
    icon: ReactNode
    title: string
    department: string
    value: string
    trend: string
    percentage: number
    iconClassName?: string
  }[]
  chartData: {
    day: string
    earning: number
    fill: string
  }[]
  className?: string
}

const earningReportChartConfig = {
  earning: {
    label: 'Activity'
  }
} satisfies ChartConfig

const EarningReportCard = ({ title, subTitle, statData, chartData, className }: Props) => {
  if (!statData.length && !chartData.length) {
    return (
      <PendingAnalyticsCard title={title} description={subTitle} className={className} contentClassName='min-h-64' />
    )
  }

  return (
    <Card className={className}>
      <CardHeader className='flex justify-between'>
        <div className='flex flex-col gap-1'>
          <span className='text-lg font-semibold'>{title}</span>
          <span className='text-muted-foreground text-sm'>{subTitle}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' />}
          >
            <EllipsisVerticalIcon />
            <span className='sr-only'>Menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuGroup>
              {listItems.map((item, index) => (
                <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col justify-between gap-6 text-base'>
        <div className='flex flex-col gap-4'>
          {statData.map((earning, index) => (
            <div key={index} className='flex items-center justify-between gap-2'>
              <div className='flex items-center justify-between gap-2'>
                <Avatar size='lg' className='rounded-sm after:border-0'>
                  <AvatarFallback
                    className={cn('bg-primary/10 text-primary shrink-0 rounded-sm *:size-5', earning.iconClassName)}
                  >
                    {earning.icon}
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0.5'>
                  <span className='font-medium'>{earning.title}</span>
                  <span className='text-muted-foreground text-sm'>{earning.department}</span>
                </div>
              </div>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-muted-foreground'>{earning.value}</span>
                <div className='flex items-center gap-1'>
                  {earning.trend === 'up' ? (
                    <ChevronUpIcon className='size-4' />
                  ) : (
                    <ChevronDownIcon className='size-4' />
                  )}
                  <span className='text-sm'>{earning.percentage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <ChartContainer config={earningReportChartConfig} className='h-45 w-full text-sm uppercase'>
          <BarChart
            accessibilityLayer
            data={chartData}
            barSize={36}
            margin={{
              top: 7,
              left: -4,
              right: -4
            }}
          >
            <XAxis
              dataKey='day'
              tickLine={false}
              tickMargin={5.5}
              axisLine={false}
              tickFormatter={value => value.slice(0, 2)}
              tick={{ fill: 'var(--muted-foreground)' }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className='normal-case' />} />
            <Bar dataKey='earning' radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default EarningReportCard
