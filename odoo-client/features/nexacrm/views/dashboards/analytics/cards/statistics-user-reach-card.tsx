'use client'

import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/nexacrm/components/ui/card'
import { type ChartConfig, ChartContainer } from '@/features/nexacrm/components/ui/chart'

import { CARD_SLOT, chartToken } from '../analytics-palette'

const userReachChartData = [{ visitors: 500, fill: 'var(--color-visitors)' }]

const userReachChartConfig = {
  visitors: {
    label: 'Contacts',
    color: chartToken(CARD_SLOT.outreach)
  }
} satisfies ChartConfig

const StatisticsCardData = {
  title: 'Outreach',
  description: 'Last week',
  children: (
    <>
      <ChartContainer config={userReachChartConfig} className='h-21 w-full'>
        <RadialBarChart data={userReachChartData} startAngle={90} endAngle={250} innerRadius={43} outerRadius={32}>
          <PolarGrid
            gridType='circle'
            radialLines={false}
            stroke='none'
            className='last:fill-card first:fill-[color-mix(in_oklab,var(--chart-5)_14%,transparent)]'
            polarRadius={[42, 32]}
          />
          <RadialBar dataKey='visitors' />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <text x={viewBox.cx} y={20} textAnchor='middle' dominantBaseline='middle'>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) - 8}
                        className='fill-foreground text-base font-semibold'
                      >
                        {userReachChartData[0].visitors.toLocaleString()}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 15} className='fill-muted-foreground text-xs'>
                        Contacts
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
    </>
  ),
  value: '32K',
  changePercentage: '+12%'
}

const StatisticsUserReachCard = ({ className }: { className?: string }) => {
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

export default StatisticsUserReachCard
