import PendingAnalyticsCard from './pending-card'

const UpgradeYourPlanCard = ({ className }: { className?: string }) => (
  <PendingAnalyticsCard
    title='Plan and billing'
    description='Billing integration is not connected'
    className={className}
    contentClassName='min-h-64'
  />
)

export default UpgradeYourPlanCard
