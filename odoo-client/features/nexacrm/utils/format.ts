// Third-party Imports
import { format } from 'date-fns'

const numberFormatter = new Intl.NumberFormat('en-US')

export const formatNumber = (value: number): string => numberFormatter.format(value)

export const formatCompactCurrency = (value: number): string => {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`

  return `${sign}$${abs}`
}

export const formatDate = (iso: string): string => format(new Date(iso), 'MMM d, yyyy')
