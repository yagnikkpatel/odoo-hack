'use client'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'

// Store Imports
import type { StagesStoreHook } from '@/features/nexacrm/store/create-stages-store'

// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'
import { BADGE_TONES } from '@/features/nexacrm/lib/badge-tone'
import { cn } from '@/features/nexacrm/lib/utils'

type StageBadgeProps = {
  stagesStore: StagesStoreHook

  /** The stage id - for a module with an unset state, its sentinel (e.g. `NO_STATUS`). */
  stage: string
  fallbackLabel: string
  fallbackTone: BadgeTone
  className?: string
}

const StageBadge = ({ stagesStore, stage, fallbackLabel, fallbackTone, className }: StageBadgeProps) => {
  const label = stagesStore(state => state.labels[stage])
  const tone = stagesStore(state => state.tones[stage])

  return (
    <Badge variant='secondary' className={cn(BADGE_TONES[tone ?? fallbackTone], className)}>
      {label ?? fallbackLabel}
    </Badge>
  )
}

export default StageBadge
