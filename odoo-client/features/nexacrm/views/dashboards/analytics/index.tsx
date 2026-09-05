'use client'

// Component Imports
import { Card } from '@/features/nexacrm/components/ui/card'

// Util Imports
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'

// Local Imports
import { StatisticsCardData, dealsData, earningReportChartData, statData } from './analytics-data'
import EarningReportCard from './cards/chart-earning-report'
import TotalSalesCard from './cards/chart-total-sales'
import TotalTransactionCard from './cards/chart-total-transaction'
import DealsDatatable from './table/datatable-deals'
import StatisticsCard from './cards/statistics-card-05'
import StatisticsOrderCard from './cards/statistics-order-card'
import StatisticsProfitCard from './cards/statistics-profit-card'
import StatisticsTotalProfitCard from './cards/statistics-total-profit-card'
import StatisticsUserReachCard from './cards/statistics-user-reach-card'
import CampaignCard from './cards/card-campaign'
import UpgradeYourPlanCard from './cards/card-upgrade-plan'

const AnalyticsDashboardView = () => (
  <div className='flex min-h-full flex-col'>
    <div className={PAGE_BODY}>
      <p className='text-muted-foreground text-sm' role='status'>
        Analytics data connection pending. Metrics will appear once the business-data APIs are connected.
      </p>
      <div className='grid grid-cols-6 gap-6'>
        <StatisticsTotalProfitCard className='max-xl:col-span-2 max-md:col-span-3' />
        <StatisticsOrderCard className='max-xl:col-span-2 max-md:col-span-3' />
        <StatisticsProfitCard className='max-xl:col-span-2 max-md:col-span-3' />
        <StatisticsUserReachCard className='max-xl:col-span-2 max-md:col-span-3' />

        {StatisticsCardData.map((card, index) => (
          <StatisticsCard
            key={index}
            icon={card.icon}
            title={card.title}
            time={card.badgeContent}
            value={card.value}
            changePercentage={card.changePercentage}
            className='max-xl:col-span-2 max-md:col-span-3'
            iconClassName={card.iconClassName}
          />
        ))}

        <TotalTransactionCard className='col-span-full lg:col-span-4' />

        <TotalSalesCard className='col-span-full sm:col-span-3 lg:col-span-2' />

        <UpgradeYourPlanCard className='col-span-full sm:col-span-3 lg:col-span-2' />

        <EarningReportCard
          title='Weekly performance'
          subTitle='Activity and revenue this week'
          statData={statData}
          chartData={earningReportChartData}
          className='col-span-full sm:col-span-3 lg:col-span-2'
        />

        <CampaignCard className='col-span-full sm:col-span-3 lg:col-span-2' />

        <Card className='col-span-full py-0'>
          <DealsDatatable data={dealsData} />
        </Card>
      </div>
    </div>
  </div>
)

export default AnalyticsDashboardView
