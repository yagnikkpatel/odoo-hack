'use client'

import Link from 'next/link'

import { Bar, BarChart, LabelList, XAxis } from 'recharts'

import { EllipsisVerticalIcon, CircleDollarSignIcon, WalletIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/features/nexacrm/components/ui/avatar'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent, CardHeader } from '@/features/nexacrm/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/features/nexacrm/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { Separator } from '@/features/nexacrm/components/ui/separator'

import { cn } from '@/features/nexacrm/lib/utils'

import { CARD_SLOT, CHIP, chartTint, chartToken } from '../analytics-palette'

const listItems = ['Share', 'Update', 'Refresh']

const transactionsChartData = [
  { month: 'January', transaction: '38000', fill: chartTint(CARD_SLOT.totalTransaction, 20) },
  { month: 'February', transaction: '52000', fill: chartToken(CARD_SLOT.totalTransaction) },
  { month: 'March', transaction: '32000', fill: chartTint(CARD_SLOT.totalTransaction, 20) },
  { month: 'April', transaction: '12000', fill: chartTint(CARD_SLOT.totalTransaction, 20) },
  { month: 'May', transaction: '35000', fill: chartTint(CARD_SLOT.totalTransaction, 20) },
  { month: 'June', transaction: '28000', fill: chartTint(CARD_SLOT.totalTransaction, 20) },
  { month: 'July', transaction: '33000', fill: chartTint(CARD_SLOT.totalTransaction, 20) },
  { month: 'August', transaction: '25000', fill: chartTint(CARD_SLOT.totalTransaction, 20) }
]

const transactionsChartConfig = {
  transaction: {
    label: 'Closed'
  }
} satisfies ChartConfig

const TotalTransactionCard = ({ className }: { className?: string }) => {
  return (
    <Card className={cn('grid grid-cols-1 gap-4 md:grid-cols-5', className)}>
      <div className='max-md:border-b md:col-span-3 md:border-r md:pr-4'>
        <CardHeader className='flex justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Deals closed</span>
            <span className='text-muted-foreground text-sm'>Monthly overview</span>
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
        <CardContent className='max-md:pb-6'>
          <ChartContainer config={transactionsChartConfig} className='h-83 w-full'>
            <BarChart
              accessibilityLayer
              data={transactionsChartData}
              barSize={35}
              margin={{
                top: 7
              }}
            >
              <XAxis
                dataKey='month'
                tickLine={false}
                tickMargin={5.5}
                axisLine={false}
                minTickGap={15}
                tickFormatter={value => value.slice(0, 3)}
                tick={{ fontSize: 14, fill: 'var(--muted-foreground)' }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey='transaction' radius={10}>
                <LabelList
                  position='top'
                  offset={12}
                  className='fill-card-foreground font-semibold'
                  fontSize={16}
                  formatter={(value: unknown) => `${String(value).slice(0, 2)}K`}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </div>
      <div className='flex flex-col gap-8 md:col-span-2'>
        <CardHeader className='flex justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Summary</span>
            <span className='text-muted-foreground text-sm'>Last month closed $23.4K</span>
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
        <CardContent className='flex flex-1 items-center text-base'>
          <div className='flex flex-1 justify-around gap-1'>
            <div className='flex flex-col items-center gap-4 p-2'>
              <Avatar className='size-12 rounded-sm after:border-0'>
                <AvatarFallback className={cn('shrink-0 rounded-sm', CHIP[3])}>
                  <CircleDollarSignIcon className='size-6' />
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col items-center gap-1'>
                <span className='text-muted-foreground'>Won this week</span>
                <span className='text-2xl font-medium'>+82.46%</span>
              </div>
            </div>
            <Separator orientation='vertical' className='h-[inherit]!' />
            <div className='flex flex-col items-center gap-4 p-2'>
              <Avatar className='size-12 rounded-sm after:border-0'>
                <AvatarFallback className={cn('shrink-0 rounded-sm', CHIP[4])}>
                  <WalletIcon className='size-6' />
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col items-center gap-1'>
                <span className='text-muted-foreground'>Lost this week</span>
                <span className='text-2xl font-medium'>-24.8%</span>
              </div>
            </div>
          </div>
        </CardContent>
        <div className='px-6'>
          <Separator />
        </div>
        <div className='flex items-center justify-between gap-2 px-6'>
          <div className='flex flex-col gap-2'>
            <span className='text-muted-foreground text-base'>Performance</span>
            <span className='text-xl font-medium'>+94.13%</span>
          </div>
          <Button render={<Link href='/dashboards/sales' />}>View Report</Button>
        </div>
      </div>
    </Card>
  )
}

export default TotalTransactionCard
