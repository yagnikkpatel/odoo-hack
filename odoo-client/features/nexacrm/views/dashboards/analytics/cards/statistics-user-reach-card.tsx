import PendingAnalyticsCard from './pending-card'

const StatisticsUserReachCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard title='Outreach' description='Last week' className={className} contentClassName='min-h-28' />
)

export default StatisticsUserReachCard
