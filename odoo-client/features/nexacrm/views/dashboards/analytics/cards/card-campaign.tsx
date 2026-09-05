import PendingAnalyticsCard from './pending-card'

const CampaignCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard
    title='Campaigns'
    description='Campaign activity'
    className={className}
    contentClassName='min-h-64'
  />
)

export default CampaignCard
