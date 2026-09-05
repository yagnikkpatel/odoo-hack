export const BADGE_TONES = {
  neutral:
    'bg-[color-mix(in_oklab,#595959_10%,transparent)] text-[#595959] border-[color-mix(in_oklab,#595959_30%,transparent)] dark:bg-[color-mix(in_oklab,#d3d3d3_10%,transparent)] dark:text-[#d3d3d3] dark:border-[color-mix(in_oklab,#d3d3d3_30%,transparent)]',
  info: 'bg-[color-mix(in_oklab,#3150bb_10%,transparent)] text-[#3150bb] border-[color-mix(in_oklab,#3150bb_30%,transparent)] dark:bg-[color-mix(in_oklab,#bbd0ff_10%,transparent)] dark:text-[#bbd0ff] dark:border-[color-mix(in_oklab,#bbd0ff_30%,transparent)]',
  purple:
    'bg-[color-mix(in_oklab,#5d47af_10%,transparent)] text-[#5d47af] border-[color-mix(in_oklab,#5d47af_30%,transparent)] dark:bg-[color-mix(in_oklab,#d8c5ff_10%,transparent)] dark:text-[#d8c5ff] dark:border-[color-mix(in_oklab,#d8c5ff_30%,transparent)]',
  success:
    'bg-[color-mix(in_oklab,#006936_10%,transparent)] text-[#006936] border-[color-mix(in_oklab,#006936_30%,transparent)] dark:bg-[color-mix(in_oklab,#59eca0_10%,transparent)] dark:text-[#59eca0] dark:border-[color-mix(in_oklab,#59eca0_30%,transparent)]',
  warning:
    'bg-[color-mix(in_oklab,#ab2800_10%,transparent)] text-[#ab2800] border-[color-mix(in_oklab,#ab2800_30%,transparent)] dark:bg-[color-mix(in_oklab,#ffba71_10%,transparent)] dark:text-[#ffba71] dark:border-[color-mix(in_oklab,#ffba71_30%,transparent)]',
  danger:
    'bg-[color-mix(in_oklab,#b5001b_10%,transparent)] text-[#b5001b] border-[color-mix(in_oklab,#b5001b_30%,transparent)] dark:bg-[color-mix(in_oklab,#ffb0ad_10%,transparent)] dark:text-[#ffb0ad] dark:border-[color-mix(in_oklab,#ffb0ad_30%,transparent)]'
} as const

export type BadgeTone = keyof typeof BADGE_TONES
