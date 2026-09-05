// Type Imports
import type { Company, CompanyIndustry, CompanyStatus } from '@/features/nexacrm/types/apps/company-types'

export type CompanySeed = Omit<Company, 'createdAt' | 'updatedAt'> & {
  createdMinutesAgo: number
  updatedMinutesAgo: number
}

type CompanyRow = [
  name: string,
  domain: string,
  industry: CompanyIndustry,
  status: CompanyStatus,
  employees: number,
  arrThousands: number,
  city: string,
  country: string
]

const SCALE_COMPANIES: CompanyRow[] = [
  ['Northwind Systems', 'northwind.io', 'software', 'customer', 1400, 210, 'Boston', 'United States'],
  ['BluePeak Industries', 'bluepeak.com', 'manufacturing', 'engaged', 8600, 340, 'Detroit', 'United States'],
  ['Summit Partners Group', 'summitpg.com', 'other', 'prospect', 320, 0, 'Denver', 'United States'],
  ['Greenfield Corp', 'greenfield.co', 'healthcare', 'customer', 5200, 480, 'Minneapolis', 'United States'],
  ['Horizon Technologies', 'horizontech.com', 'software', 'engaged', 2100, 265, 'Austin', 'United States'],
  ['Velocity Solutions', 'velocity.dev', 'software', 'prospect', 180, 0, 'Portland', 'United States'],
  ['Lumen Enterprises', 'lumen-ent.com', 'media', 'customer', 3400, 390, 'Chicago', 'United States'],
  ['Apex Manufacturing', 'apexmfg.com', 'manufacturing', 'at_risk', 12000, 520, 'Cleveland', 'United States'],
  ['CloudSync Inc.', 'cloudsync.io', 'software', 'customer', 640, 175, 'Seattle', 'United States'],
  ['Finsecure Ltd.', 'finsecure.co.uk', 'fintech', 'engaged', 2800, 310, 'London', 'United Kingdom'],
  ['MediTrack Health', 'meditrack.health', 'healthcare', 'prospect', 950, 0, 'Philadelphia', 'United States'],
  ['ShopEase Co.', 'shopease.com', 'ecommerce', 'customer', 1750, 225, 'Toronto', 'Canada'],
  ['DataSecure Systems', 'datasecure.io', 'software', 'engaged', 430, 140, 'Dublin', 'Ireland'],
  ['Bright Future Ltd', 'brightfuture.org', 'education', 'prospect', 260, 0, 'Manchester', 'United Kingdom'],
  ['Vertex Innovations', 'vertexinv.com', 'other', 'customer', 5600, 445, 'Munich', 'Germany'],
  ['Global Solutions SA', 'globalsol.fr', 'other', 'engaged', 9400, 380, 'Paris', 'France'],
  ['Ironclad Logistics', 'ironclad-log.com', 'manufacturing', 'prospect', 4300, 0, 'Rotterdam', 'Netherlands'],
  ['PayBridge', 'paybridge.io', 'fintech', 'customer', 780, 195, 'Stockholm', 'Sweden'],
  ['Corewave Media', 'corewave.tv', 'media', 'at_risk', 1900, 160, 'Los Angeles', 'United States'],
  ['Trailhead Learning', 'trailhead.edu', 'education', 'engaged', 540, 120, 'Boulder', 'United States'],
  ['Nimbus Retail', 'nimbusretail.com', 'ecommerce', 'prospect', 6700, 0, 'Barcelona', 'Spain'],
  ['Sentinel Health', 'sentinelhealth.com', 'healthcare', 'customer', 8200, 610, 'Zurich', 'Switzerland'],
  ['Quantum Ledger', 'qledger.io', 'fintech', 'engaged', 210, 95, 'Singapore', 'Singapore'],
  ['Bedrock Manufacturing', 'bedrockmfg.com', 'manufacturing', 'churned', 15000, 0, 'Pittsburgh', 'United States'],
  ['Orbit Commerce', 'orbitcommerce.com', 'ecommerce', 'prospect', 1100, 0, 'Melbourne', 'Australia'],
  ['Fairview Media', 'fairview.media', 'media', 'customer', 2300, 280, 'New York', 'United States'],
  ['Latitude Software', 'latitude.sh', 'software', 'engaged', 370, 130, 'Lisbon', 'Portugal'],
  ['Kestrel Capital', 'kestrelcap.com', 'fintech', 'prospect', 890, 0, 'Frankfurt', 'Germany'],
  ['Redwood Education', 'redwood.edu', 'education', 'at_risk', 720, 85, 'Sacramento', 'United States'],
  ['Everline Retail', 'everline.com', 'ecommerce', 'customer', 4900, 355, 'Milan', 'Italy'],
  ['Pinnacle Health Group', 'pinnaclehg.com', 'healthcare', 'engaged', 11000, 470, 'Houston', 'United States'],
  ['Arcadia Studios', 'arcadiastudios.com', 'media', 'prospect', 150, 0, 'Vancouver', 'Canada'],
  ['Beacon Logistics', 'beaconlog.com', 'manufacturing', 'customer', 3800, 300, 'Hamburg', 'Germany'],
  ['Thornton Advisory', 'thornton.co', 'other', 'churned', 640, 0, 'Edinburgh', 'United Kingdom'],
  ['Silverline Fintech', 'silverline.fi', 'fintech', 'prospect', 460, 0, 'Helsinki', 'Finland'],
  ['Cascade Systems', 'cascadesys.io', 'software', 'at_risk', 1250, 155, 'Calgary', 'Canada']
]

const ACCOUNT_OWNERS = ['usr_1', 'usr_2', 'usr_3', 'usr_5', 'usr_7', 'usr_8', 'usr_9', 'usr_10']

const CREATED_JITTER = [0, 3100, -1700, 4300, -900, 2200]

export const scaleCompanies = (): CompanySeed[] =>
  SCALE_COMPANIES.map(([name, domainName, industry, status, employees, arrThousands, city, country], index) => ({
    id: `cmp_${25 + index}`,
    name,
    domainName,
    industry,
    status,
    employees,
    icp: employees >= 1000 && status !== 'churned',
    ...(arrThousands > 0 ? { arr: arrThousands * 1000 } : {}),
    address: { city, country },
    accountOwnerId: ACCOUNT_OWNERS[index % ACCOUNT_OWNERS.length],

    createdMinutesAgo: 9000 + index * 16000 + CREATED_JITTER[index % CREATED_JITTER.length],
    updatedMinutesAgo: 240 + index * 190
  }))

export const db: CompanySeed[] = [
  {
    id: 'cmp_1',
    name: 'Airbnb',
    domainName: 'airbnb.com',
    logo: '/images/brands/airbnb-icon.webp',
    employees: 6900,
    icp: false,
    status: 'prospect',
    industry: 'ecommerce',
    address: {
      street1: '888 Brannan St',
      city: 'San Francisco',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/airbnb',
    xUrl: 'x.com/airbnb',
    accountOwnerId: 'usr_3',
    updatedById: 'usr_2',
    createdById: 'usr_2',
    createdMinutesAgo: 21420,
    updatedMinutesAgo: 58
  },
  {
    id: 'cmp_2',
    name: 'Anthropic',
    domainName: 'anthropic.com',
    logo: '/images/brands/claude.webp',
    employees: 1100,
    icp: true,
    status: 'customer',
    industry: 'software',
    address: {
      street1: '548 Market St',
      city: 'San Francisco',
      country: 'United States'
    },
    arr: 240000,
    linkedinUrl: 'linkedin.com/company/anthropicresearch',
    accountOwnerId: 'usr_1',
    updatedById: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 147600,
    updatedMinutesAgo: 336
  },
  {
    id: 'cmp_3',
    name: 'Stripe',
    domainName: 'stripe.com',
    employees: 8000,
    icp: true,
    status: 'customer',
    industry: 'fintech',
    address: {
      street1: '354 Oyster Point Blvd',
      city: 'South San Francisco',
      country: 'United States'
    },
    arr: 180000,
    linkedinUrl: 'linkedin.com/company/stripe',
    xUrl: 'x.com/stripe',
    accountOwnerId: 'usr_1',
    updatedById: 'usr_4',
    createdMinutesAgo: 192663,
    updatedMinutesAgo: 621
  },
  {
    id: 'cmp_4',
    name: 'Figma',
    domainName: 'figma.com',
    logo: '/images/brands/figma-icon.webp',
    employees: 1300,
    icp: true,
    status: 'at_risk',
    industry: 'software',
    address: {
      street1: '760 Market St',
      city: 'San Francisco',
      country: 'United States'
    },
    arr: 96000,
    linkedinUrl: 'linkedin.com/company/figma',
    accountOwnerId: 'usr_2',
    createdById: 'usr_4',
    createdMinutesAgo: 90522,
    updatedMinutesAgo: 1031
  },
  {
    id: 'cmp_5',
    name: 'Notion',
    domainName: 'notion.com',
    logo: '/images/brands/notion-white.webp',
    employees: 1200,
    icp: false,
    status: 'prospect',
    industry: 'software',
    address: {
      street1: '2300 Harrison St',
      city: 'San Francisco',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/notionhq',
    updatedById: 'usr_1',
    createdById: 'usr_2',
    createdMinutesAgo: 60480,
    updatedMinutesAgo: 1379
  },
  {
    id: 'cmp_6',
    name: 'Google',
    domainName: 'google.com',
    logo: '/images/brands/google-icon.webp',
    employees: 182000,
    icp: true,
    status: 'customer',
    industry: 'software',
    address: {
      street1: '1600 Amphitheatre Pkwy',
      city: 'Mountain View',
      country: 'United States'
    },
    arr: 320000,
    linkedinUrl: 'linkedin.com/company/google',
    xUrl: 'x.com/google',
    accountOwnerId: 'usr_1',
    updatedById: 'usr_2',
    createdMinutesAgo: 303813,
    updatedMinutesAgo: 1643
  },
  {
    id: 'cmp_7',
    name: 'Meta',
    domainName: 'meta.com',
    logo: '/images/brands/meta-icon.webp',
    employees: 76000,
    icp: false,
    status: 'churned',
    industry: 'media',
    address: {
      street1: '1 Hacker Way',
      city: 'Menlo Park',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/meta',
    accountOwnerId: 'usr_4',
    updatedById: 'usr_3',
    createdById: 'usr_1',
    createdMinutesAgo: 231714,
    updatedMinutesAgo: 2047
  },
  {
    id: 'cmp_8',
    name: 'Microsoft',
    domainName: 'microsoft.com',
    logo: '/images/brands/microsoft-icon.webp',
    employees: 221000,
    icp: true,
    status: 'customer',
    industry: 'software',
    address: {
      street1: 'One Microsoft Way',
      city: 'Redmond',
      country: 'United States'
    },
    arr: 450000,
    linkedinUrl: 'linkedin.com/company/microsoft',
    xUrl: 'x.com/microsoft',
    accountOwnerId: 'usr_3',
    updatedById: 'usr_4',
    createdById: 'usr_3',
    createdMinutesAgo: 342864,
    updatedMinutesAgo: 684
  },
  {
    id: 'cmp_9',
    name: 'Amazon',
    domainName: 'amazon.com',
    logo: '/images/brands/amazon-logo.webp',
    employees: 1525000,
    icp: false,
    status: 'prospect',
    industry: 'ecommerce',
    address: {
      street1: '410 Terry Ave N',
      city: 'Seattle',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/amazon',
    createdById: 'usr_4',
    createdMinutesAgo: 270765,
    updatedMinutesAgo: 2380
  },
  {
    id: 'cmp_10',
    name: 'Apple',
    domainName: 'apple.com',
    logo: '/images/brands/apple-icon.webp',
    employees: 161000,
    icp: true,
    status: 'customer',
    industry: 'manufacturing',
    address: {
      street1: 'One Apple Park Way',
      city: 'Cupertino',
      country: 'United States'
    },
    arr: 500000,
    linkedinUrl: 'linkedin.com/company/apple',
    accountOwnerId: 'usr_2',
    updatedById: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 484065,
    updatedMinutesAgo: 2714
  },
  {
    id: 'cmp_11',
    name: 'GitHub',
    domainName: 'github.com',
    logo: '/images/brands/github-icon.webp',
    employees: 3500,
    icp: true,
    status: 'customer',
    industry: 'software',
    address: {
      street1: '88 Colin P Kelly Jr St',
      city: 'San Francisco',
      country: 'United States'
    },
    arr: 72000,
    linkedinUrl: 'linkedin.com/company/github',
    accountOwnerId: 'usr_3',
    updatedById: 'usr_2',
    createdById: 'usr_2',
    createdMinutesAgo: 108549,
    updatedMinutesAgo: 378
  },
  {
    id: 'cmp_12',
    name: 'Dropbox',
    domainName: 'dropbox.com',
    logo: '/images/brands/dropbox-icon-circle.webp',
    employees: 2600,
    icp: false,
    status: 'prospect',
    industry: 'software',
    address: {
      street1: '1800 Owens St',
      city: 'San Francisco',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/dropbox',
    updatedById: 'usr_3',
    createdById: 'usr_3',
    createdMinutesAgo: 165627,
    updatedMinutesAgo: 3048
  },
  {
    id: 'cmp_13',
    name: 'Shopify',
    domainName: 'shopify.com',
    logo: '/images/brands/shopify-icon.webp',
    employees: 8300,
    icp: true,
    status: 'at_risk',
    industry: 'ecommerce',
    address: {
      street1: '151 O’Connor St',
      city: 'Ottawa',
      country: 'Canada'
    },
    arr: 130000,
    linkedinUrl: 'linkedin.com/company/shopify',
    xUrl: 'x.com/shopify',
    accountOwnerId: 'usr_4',
    updatedById: 'usr_4',
    createdMinutesAgo: 129573,
    updatedMinutesAgo: 1045
  },
  {
    id: 'cmp_14',
    name: 'Slack',
    domainName: 'slack.com',
    logo: '/images/brands/slack-icon.webp',
    employees: 3000,
    icp: true,
    status: 'customer',
    industry: 'software',
    address: {
      street1: '500 Howard St',
      city: 'San Francisco',
      country: 'United States'
    },
    arr: 88000,
    linkedinUrl: 'linkedin.com/company/tiny-speck',
    accountOwnerId: 'usr_1',
    createdById: 'usr_4',
    createdMinutesAgo: 48465,
    updatedMinutesAgo: 72
  },
  {
    id: 'cmp_15',
    name: 'Netflix',
    domainName: 'netflix.com',
    logo: '/images/brands/netflix-icon-circle.webp',
    employees: 13000,
    icp: true,
    status: 'customer',
    industry: 'media',
    address: {
      street1: '121 Albright Way',
      city: 'Los Gatos',
      country: 'United States'
    },
    arr: 210000,
    linkedinUrl: 'linkedin.com/company/netflix',
    accountOwnerId: 'usr_2',
    updatedById: 'usr_1',
    createdById: 'usr_2',
    createdMinutesAgo: 550152,
    updatedMinutesAgo: 3382
  },
  {
    id: 'cmp_16',
    name: 'Adobe',
    domainName: 'adobe.com',
    logo: '/images/brands/adobe-logo.webp',
    employees: 29000,
    icp: true,
    status: 'at_risk',
    industry: 'software',
    address: {
      street1: '345 Park Ave',
      city: 'San Jose',
      country: 'United States'
    },
    arr: 380000,
    linkedinUrl: 'linkedin.com/company/adobe',
    xUrl: 'x.com/adobe',
    accountOwnerId: 'usr_1',
    updatedById: 'usr_2',
    createdMinutesAgo: 508095,
    updatedMinutesAgo: 3716
  },
  {
    id: 'cmp_17',
    name: 'Salesforce',
    domainName: 'salesforce.com',
    employees: 73000,
    icp: true,
    status: 'churned',
    industry: 'software',
    address: {
      street1: '415 Mission St',
      city: 'San Francisco',
      country: 'United States'
    },
    arr: 410000,
    linkedinUrl: 'linkedin.com/company/salesforce',
    accountOwnerId: 'usr_3',
    updatedById: 'usr_3',
    createdById: 'usr_1',
    createdMinutesAgo: 387927,
    updatedMinutesAgo: 4049
  },
  {
    id: 'cmp_18',
    name: 'Oracle',
    domainName: 'oracle.com',
    employees: 143000,
    icp: false,
    status: 'prospect',
    industry: 'software',
    address: {
      street1: '2300 Oracle Way',
      city: 'Austin',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/oracle',
    accountOwnerId: 'usr_4',
    updatedById: 'usr_4',
    createdById: 'usr_3',
    createdMinutesAgo: 583200,
    updatedMinutesAgo: 4383
  },
  {
    id: 'cmp_19',
    name: 'Nvidia',
    domainName: 'nvidia.com',
    employees: 29600,
    icp: true,
    status: 'customer',
    industry: 'manufacturing',
    address: {
      street1: '2788 San Tomas Expy',
      city: 'Santa Clara',
      country: 'United States'
    },
    arr: 520000,
    linkedinUrl: 'linkedin.com/company/nvidia',
    xUrl: 'x.com/nvidia',
    accountOwnerId: 'usr_1',
    createdById: 'usr_4',
    createdMinutesAgo: 451017,
    updatedMinutesAgo: 378
  },
  {
    id: 'cmp_20',
    name: 'Uber',
    domainName: 'uber.com',
    employees: 32800,
    icp: false,
    status: 'engaged',
    industry: 'ecommerce',
    address: {
      street1: '1725 3rd St',
      city: 'San Francisco',
      country: 'United States'
    },
    linkedinUrl: 'linkedin.com/company/uber-com',
    accountOwnerId: 'usr_3',
    updatedById: 'usr_1',
    createdById: 'usr_1',
    createdMinutesAgo: 339867,
    updatedMinutesAgo: 4717
  },
  {
    id: 'cmp_21',
    name: 'Airtable',
    domainName: 'airtable.com',
    employees: 1000,
    icp: true,
    status: 'engaged',
    industry: 'software',
    address: {
      street1: '155 5th St',
      city: 'San Francisco',
      country: 'United States'
    },
    arr: 64000,
    linkedinUrl: 'linkedin.com/company/airtable',
    accountOwnerId: 'usr_2',
    updatedById: 'usr_2',
    createdById: 'usr_2',
    createdMinutesAgo: 321840,
    updatedMinutesAgo: 5051
  },
  {
    id: 'cmp_22',
    name: 'Snowflake',
    domainName: 'snowflake.com',
    employees: 7000,
    icp: true,
    status: 'engaged',
    industry: 'software',
    address: {
      street1: '106 E Babcock St',
      city: 'Bozeman',
      country: 'United States'
    },
    arr: 150000,
    linkedinUrl: 'linkedin.com/company/snowflake-computing',
    accountOwnerId: 'usr_1',
    updatedById: 'usr_4',
    createdMinutesAgo: 240723,
    updatedMinutesAgo: 5718
  },
  {
    id: 'cmp_23',
    name: 'Datadog',
    domainName: 'datadoghq.com',
    employees: 5000,
    icp: true,
    status: 'engaged',
    industry: 'software',
    address: {
      street1: '620 8th Ave',
      city: 'New York',
      country: 'United States'
    },
    arr: 98000,
    linkedinUrl: 'linkedin.com/company/datadog',
    xUrl: 'x.com/datadoghq',
    accountOwnerId: 'usr_3',
    createdById: 'usr_4',
    createdMinutesAgo: 198666,
    updatedMinutesAgo: 6052
  },
  {
    id: 'cmp_24',
    name: 'MongoDB',
    domainName: 'mongodb.com',
    employees: 4800,
    icp: true,
    status: 'engaged',
    industry: 'software',
    address: {
      street1: '1633 Broadway',
      city: 'New York',
      country: 'United States'
    },
    arr: 110000,
    linkedinUrl: 'linkedin.com/company/mongodbinc',
    xUrl: 'x.com/mongodb',
    accountOwnerId: 'usr_2',
    createdById: 'usr_4',
    createdMinutesAgo: 219699,
    updatedMinutesAgo: 7721
  },

  ...scaleCompanies()
]
