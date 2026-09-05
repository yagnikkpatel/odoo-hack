'use client'

import { Bar, BarChart } from 'recharts'

import { Card, CardDescription, CardContent, CardHeader, CardTitle } from '@/features/nexacrm/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/features/nexacrm/components/ui/chart'

import { CARD_SLOT, chartTint, chartToken } from '../analytics-palette'

const orderChartData = [
  { day: 'Monday', orders: 120 },
  { day: 'Tuesday', orders: 285 },
  { day: 'Wednesday', orders: 190 },
  { day: 'Thursday', orders: 190 },
  { day: 'Friday', orders: 315 },
  { day: 'Saturday', orders: 190 },
  { day: 'Sunday', orders: 220 }
]

const orderChartConfig = {
  orders: {
    label: 'Opportunities',
    color: chartToken(CARD_SLOT.order)
  }
} satisfies ChartConfig

const StatisticsCardData = {
  title: 'Opportunities',
  description: 'Last week',
  children: (
    <>
      <ChartContainer config={orderChartConfig} className='h-21 w-full'>
        <BarChart
          accessibilityLayer
          data={orderChartData}
          barSize={12}
          margin={{
            left: -4,
            right: -6
          }}
        >
          <Bar
            dataKey='orders'
            fill='var(--color-orders)'
            background={{ fill: chartTint(CARD_SLOT.order, 14), radius: 12 }}
            radius={12}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        </BarChart>
      </ChartContainer>
    </>
  ),
  value: '124K',
  changePercentage: '+12.6%'
}

const StatisticsOrderCard = ({ className }: { className?: string }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='text-lg font-semibold'>{StatisticsCardData.title}</CardTitle>
        <CardDescription className='text-muted-foreground text-base'>{StatisticsCardData.description}</CardDescription>
      </CardHeader>
      <CardContent>{StatisticsCardData.children}</CardContent>

      <CardContent className='flex items-center justify-between'>
        <span className='text-xl font-semibold'>{StatisticsCardData.value}</span>
        <span className='text-primary text-base'>{StatisticsCardData.changePercentage}</span>
      </CardContent>
    </Card>
  )
}

export default StatisticsOrderCard
