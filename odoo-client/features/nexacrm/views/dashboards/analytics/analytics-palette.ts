/** A ramp slot. Five, because `globals.css` defines `--chart-1` … `--chart-5` and nothing more. */
export type ChartSlot = 1 | 2 | 3 | 4 | 5

/** The solid token for a card's own colour. */
export const chartToken = (slot: ChartSlot) => `var(--chart-${slot})`

/**
 * A transparent tint of the same token, for marks that must recede. Keeps a card internally
 * related instead of introducing a grey that belongs to no series.
 */
export const chartTint = (slot: ChartSlot, percent: number) =>
  `color-mix(in oklab, var(--chart-${slot}) ${percent}%, transparent)`

export const CHIP: Record<ChartSlot, string> = {
  1: 'bg-chart-1/10 text-chart-1',
  2: 'bg-chart-2/10 text-chart-2',
  3: 'bg-chart-3/10 text-chart-3',
  4: 'bg-chart-4/10 text-chart-4',
  5: 'bg-chart-5/10 text-chart-5'
}

export const CARD_SLOT = {
  totalProfit: 2,
  order: 3,
  profit: 4,
  outreach: 5,
  totalTransaction: 1,
  totalSales: 2,
  earningReport: 3
} as const satisfies Record<string, ChartSlot>
