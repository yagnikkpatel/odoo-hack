// Third-party Imports
import { ChartPieIcon, CircleDollarSignIcon, DollarSignIcon, TrendingDownIcon, WalletIcon } from 'lucide-react'

// Type Imports
import type { Item } from './table/datatable-deals'

// Palette Imports
import { CARD_SLOT, CHIP, chartTint, chartToken } from './analytics-palette'

export const StatisticsCardData = [
  {
    icon: <CircleDollarSignIcon />,
    title: 'Won this month',
    badgeContent: 'Last week',
    value: '$4,673',
    changePercentage: 25.2,
    iconClassName: CHIP[2]
  },
  {
    icon: <TrendingDownIcon />,
    title: 'Lost this month',
    badgeContent: 'Last month',
    value: '$1.28K',
    changePercentage: -12.2,
    iconClassName: CHIP[5]
  }
]

export const statData = [
  {
    icon: <ChartPieIcon />,
    title: 'Won revenue',
    department: 'Closed deals',
    value: '$1,623',
    trend: 'up',
    percentage: 20.3,
    iconClassName: CHIP[1]
  },
  {
    icon: <DollarSignIcon />,
    title: 'Pipeline created',
    department: 'Inbound, referral',
    value: '$5,600',
    trend: 'up',
    percentage: 16.2,
    iconClassName: CHIP[4]
  },
  {
    icon: <WalletIcon />,
    title: 'Expansion revenue',
    department: 'Upsells, renewals',
    value: '$3,200',
    trend: 'up',
    percentage: 10.5,
    iconClassName: CHIP[5]
  }
]

export const earningReportChartData = [
  { day: 'Monday', earning: 48, fill: chartTint(CARD_SLOT.earningReport, 20) },
  { day: 'Tuesday', earning: 147, fill: chartTint(CARD_SLOT.earningReport, 20) },
  { day: 'Wednesday', earning: 106, fill: chartTint(CARD_SLOT.earningReport, 20) },
  { day: 'Thursday', earning: 180, fill: chartToken(CARD_SLOT.earningReport) },
  { day: 'Friday', earning: 75, fill: chartTint(CARD_SLOT.earningReport, 20) },
  { day: 'Saturday', earning: 60, fill: chartTint(CARD_SLOT.earningReport, 20) },
  { day: 'Sunday', earning: 128, fill: chartTint(CARD_SLOT.earningReport, 20) }
]

export const dealsData: Item[] = [
  {
    id: '5099',
    status: 'new',
    avatar: '/images/avatars/avatar-1.webp',
    fallback: 'JA',
    contact: 'Jack Alfredo',
    company: 'Airbnb',
    amount: 3120,
    closeDate: new Date('2025-04-03'),
    gap: 0
  },
  {
    id: '5008',
    status: 'won',
    avatar: '/images/avatars/avatar-2.webp',
    fallback: 'MG',
    contact: 'Maria Gonzalez',
    company: 'Stripe',
    amount: 1450,
    closeDate: new Date('2025-05-12'),
    gap: 0
  },
  {
    id: '5101',
    status: 'won',
    avatar: '/images/avatars/avatar-3.webp',
    fallback: 'JD',
    contact: 'John Doe',
    company: 'Figma',
    amount: 1200,
    closeDate: new Date('2025-06-26'),
    gap: 0
  },
  {
    id: '4586',
    status: 'proposal',
    avatar: '/images/avatars/avatar-4.webp',
    fallback: 'EC',
    contact: 'Emily Carter',
    company: 'Notion',
    amount: 2680,
    closeDate: new Date('2025-07-05'),
    gap: -78
  },
  {
    id: '4360',
    status: 'new',
    avatar: '/images/avatars/avatar-5.webp',
    fallback: 'DL',
    contact: 'David Lee',
    company: 'Linear',
    amount: 3120,
    closeDate: new Date('2025-08-07'),
    gap: 0
  },
  {
    id: '5104',
    status: 'at risk',
    avatar: '/images/avatars/avatar-6.webp',
    fallback: 'SP',
    contact: 'Sophia Patel',
    company: 'Vercel',
    amount: 1600,
    closeDate: new Date('2025-08-26'),
    gap: 86
  },
  {
    id: '5201',
    status: 'won',
    avatar: '/images/avatars/avatar-7.webp',
    fallback: 'MW',
    contact: 'Michael Williams',
    company: 'Ramp',
    amount: 2850,
    closeDate: new Date('2025-01-15'),
    gap: 0
  },
  {
    id: '4987',
    status: 'new',
    avatar: '/images/avatars/avatar-8.webp',
    fallback: 'AB',
    contact: 'Amanda Brown',
    company: 'Retool',
    amount: 1750,
    closeDate: new Date('2025-02-20'),
    gap: 0
  },
  {
    id: '5342',
    status: 'proposal',
    avatar: '/images/avatars/avatar-9.webp',
    fallback: 'RJ',
    contact: 'Robert Johnson',
    company: 'Datadog',
    amount: 3500,
    closeDate: new Date('2025-03-10'),
    gap: -120
  },
  {
    id: '4723',
    status: 'at risk',
    avatar: '/images/avatars/avatar-10.webp',
    fallback: 'LM',
    contact: 'Lisa Miller',
    company: 'Snowflake',
    amount: 2200,
    closeDate: new Date('2025-04-18'),
    gap: 250
  },
  {
    id: '5445',
    status: 'won',
    avatar: '/images/avatars/avatar-11.webp',
    fallback: 'TD',
    contact: 'Thomas Davis',
    company: 'Segment',
    amount: 4200,
    closeDate: new Date('2025-05-22'),
    gap: 0
  },
  {
    id: '4892',
    status: 'new',
    avatar: '/images/avatars/avatar-12.webp',
    fallback: 'JW',
    contact: 'Jennifer Wilson',
    company: 'Amplitude',
    amount: 1950,
    closeDate: new Date('2025-06-14'),
    gap: 0
  },
  {
    id: '5667',
    status: 'proposal',
    avatar: '/images/avatars/avatar-13.webp',
    fallback: 'CM',
    contact: 'Christopher Moore',
    company: 'Asana',
    amount: 2750,
    closeDate: new Date('2025-07-08'),
    gap: -95
  },
  {
    id: '4534',
    status: 'at risk',
    avatar: '/images/avatars/avatar-14.webp',
    fallback: 'ST',
    contact: 'Sarah Taylor',
    company: 'Miro',
    amount: 1380,
    closeDate: new Date('2025-01-28'),
    gap: 180
  },
  {
    id: '5789',
    status: 'won',
    avatar: '/images/avatars/avatar-15.webp',
    fallback: 'MA',
    contact: 'Matthew Anderson',
    company: 'Loom',
    amount: 5600,
    closeDate: new Date('2025-02-12'),
    gap: 0
  },
  {
    id: '4398',
    status: 'new',
    avatar: '/images/avatars/avatar-16.webp',
    fallback: 'KT',
    contact: 'Karen Thompson',
    company: 'Webflow',
    amount: 2100,
    closeDate: new Date('2025-03-25'),
    gap: 0
  },
  {
    id: '5923',
    status: 'proposal',
    avatar: '/images/avatars/avatar-17.webp',
    fallback: 'JG',
    contact: 'James Garcia',
    company: 'Zapier',
    amount: 3800,
    closeDate: new Date('2025-04-30'),
    gap: -200
  },
  {
    id: '4672',
    status: 'at risk',
    avatar: '/images/avatars/avatar-18.webp',
    fallback: 'NH',
    contact: 'Nancy Harris',
    company: 'Intercom',
    amount: 1850,
    closeDate: new Date('2025-05-16'),
    gap: 320
  },
  {
    id: '5234',
    status: 'won',
    avatar: '/images/avatars/avatar-19.webp',
    fallback: 'DM',
    contact: 'Daniel Martinez',
    company: 'Mixpanel',
    amount: 4800,
    closeDate: new Date('2025-06-09'),
    gap: 0
  },
  {
    id: '4756',
    status: 'new',
    avatar: '/images/avatars/avatar-20.webp',
    fallback: 'ER',
    contact: 'Elizabeth Rodriguez',
    company: 'Twilio',
    amount: 2650,
    closeDate: new Date('2025-07-21'),
    gap: 0
  },
  {
    id: '5456',
    status: 'proposal',
    avatar: '/images/avatars/avatar-1.webp',
    fallback: 'AL',
    contact: 'Andrew Lopez',
    company: 'Cloudflare',
    amount: 5200,
    closeDate: new Date('2025-08-03'),
    gap: -150
  },
  {
    id: '4823',
    status: 'at risk',
    avatar: '/images/avatars/avatar-2.webp',
    fallback: 'MH',
    contact: 'Michelle Hill',
    company: 'Auth0',
    amount: 2400,
    closeDate: new Date('2025-01-11'),
    gap: 400
  },
  {
    id: '5678',
    status: 'won',
    avatar: '/images/avatars/avatar-3.webp',
    fallback: 'KS',
    contact: 'Kevin Scott',
    company: 'Algolia',
    amount: 3200,
    closeDate: new Date('2025-02-07'),
    gap: 0
  },
  {
    id: '4945',
    status: 'new',
    avatar: '/images/avatars/avatar-4.webp',
    fallback: 'RG',
    contact: 'Rachel Green',
    company: 'Contentful',
    amount: 1820,
    closeDate: new Date('2025-03-19'),
    gap: 0
  },
  {
    id: '5812',
    status: 'proposal',
    avatar: '/images/avatars/avatar-5.webp',
    fallback: 'BW',
    contact: 'Brian White',
    company: 'Sentry',
    amount: 6200,
    closeDate: new Date('2025-04-26'),
    gap: -300
  }
]
