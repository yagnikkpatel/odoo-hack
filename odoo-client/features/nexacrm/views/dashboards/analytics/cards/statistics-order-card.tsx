import PendingAnalyticsCard from './pending-card'

const StatisticsOrderCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard
    title='Opportunities'
    description='Last week'
    className={className}
    contentClassName='min-h-28'
  />
)

export default StatisticsOrderCard
