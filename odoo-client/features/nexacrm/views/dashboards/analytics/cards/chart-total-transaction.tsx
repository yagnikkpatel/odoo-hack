import PendingAnalyticsCard from './pending-card'

const TotalTransactionCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard
    title='Deals closed'
    description='Monthly overview'
    className={className}
    contentClassName='min-h-72'
  />
)

export default TotalTransactionCard
