const LOGOS_WITH_DARK_VARIANT = new Set([
  '/images/brands/apple-icon.webp',
  '/images/brands/github-icon.webp',
  '/images/brands/notion-icon.webp'
])

const LOGOS_INVERTED_IN_DARK = new Set([
  '/images/brands/cline-icon.webp',
  '/images/brands/copilot-icon.webp',
  '/images/brands/windsurf-icon.webp'
])

/** The dark-surface companion for a logo path, or `undefined` when the mark needs no second file. */
export const darkVariantOf = (logo: string): string | undefined =>
  logo === '/images/brands/notion-icon.webp'
    ? '/images/brands/notion-white.webp'
    : LOGOS_WITH_DARK_VARIANT.has(logo) ? logo.replace(/\.webp$/, '-dark.webp') : undefined

/** True when the mark is single-ink artwork whose dark variant is the same drawing, inverted. */
export const invertsInDark = (logo: string): boolean => LOGOS_INVERTED_IN_DARK.has(logo)
