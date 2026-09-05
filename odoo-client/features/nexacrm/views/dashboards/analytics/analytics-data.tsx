import type { ComponentProps } from 'react'
import { CircleDollarSignIcon, TrendingDownIcon } from 'lucide-react'

import type EarningReportCard from './cards/chart-earning-report'
import type StatisticsCard from './cards/statistics-card-05'
import type { Item } from './table/datatable-deals'
import { CHIP } from './analytics-palette'

// Presentation metadata only. Unknown metrics are null, never fabricated zeroes.
export const StatisticsCardData: (Omit<ComponentProps<typeof StatisticsCard>, 'time'> & { badgeContent: string })[] = [
  {
    icon: <CircleDollarSignIcon />,
    title: 'Won this month',
    badgeContent: 'Last week',
    value: null,
    changePercentage: null,
    iconClassName: CHIP[2]
  },
  {
    icon: <TrendingDownIcon />,
    title: 'Lost this month',
    badgeContent: 'Last month',
    value: null,
    changePercentage: null,
    iconClassName: CHIP[5]
  }
]

// These remain empty until the analytics API is connected.
export const statData: ComponentProps<typeof EarningReportCard>['statData'] = []
export const earningReportChartData: ComponentProps<typeof EarningReportCard>['chartData'] = []
export const dealsData: Item[] = []
