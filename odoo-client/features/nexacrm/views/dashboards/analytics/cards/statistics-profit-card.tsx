import PendingAnalyticsCard from './pending-card'

const StatisticsProfitCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard title='Pipeline' description='Last month' className={className} contentClassName='min-h-28' />
)

export default StatisticsProfitCard
