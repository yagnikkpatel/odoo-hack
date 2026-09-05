import PendingAnalyticsCard from './pending-card'

const StatisticsTotalProfitCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard
    title='Won revenue'
    description='Yearly overview'
    className={className}
    contentClassName='min-h-28'
  />
)

export default StatisticsTotalProfitCard
