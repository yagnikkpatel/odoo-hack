/**
 * The filled primary-action button - colour only, so it composes with any size.
 *
 * ! DELIBERATELY CARRIES NO RESPONSIVE SIZING. Ending it in `max-sm:size-6` would silently require
 * ! every call site to hide its label below `sm` as well - miss that on one and the button collapses
 * ! into a 24px square with its text clipped. The compact variant is its own constant, named for
 * ! what it does.
 *
 * ```tsx
 * <Button className={ACCENT_BUTTON} onClick={openCreate}>New company</Button>
 * ```
 */
export const ACCENT_BUTTON = 'bg-brand text-brand-foreground hover:bg-brand/80'

/**
 * The list-header "New …" button: accent, and a 24px icon-only square on a phone.
 *
 * ! PAIRS WITH A LABEL THAT HIDES ITSELF - the two halves are one decision, so they are shown
 * ! together here rather than left to be rediscovered:
 *
 * ```tsx
 * <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={openCreate}>
 *   <PlusIcon />
 *   <span className='max-sm:hidden'>New company</span>
 * </Button>
 * ```
 */
export const ACCENT_ICON_BUTTON = `${ACCENT_BUTTON} max-sm:size-6`

/** An icon or glyph that should read as highlighted rather than neutral. */
export const ACCENT_TEXT = 'text-brand'

/** A 10% wash of the accent - for a tile or chip sitting behind accent-coloured content. */
export const ACCENT_SURFACE = 'bg-brand/10 text-brand'
