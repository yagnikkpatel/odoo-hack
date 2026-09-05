import PendingAnalyticsCard from './pending-card'

const TotalSalesCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard
    title='Pipeline created'
    description='Inbound and outbound'
    className={className}
    contentClassName='min-h-72'
  />
)

export default TotalSalesCard
