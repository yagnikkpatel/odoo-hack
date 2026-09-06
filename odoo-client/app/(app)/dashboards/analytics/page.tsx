import type { Metadata } from 'next'

import AnalyticsDashboardView from '@/features/nexacrm/views/dashboards/analytics'
import styles from './analytics.module.css'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Live workforce, attendance, time off and payroll insights.'
}

export default function AnalyticsDashboardPage() {
  return (
    <div className={styles.entrance}>
      <AnalyticsDashboardView />
    </div>
  )
}
