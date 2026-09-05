export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false

    await navigator.clipboard.writeText(text)

    return true
  } catch {
    return false
  }
}

/** Standard message for a refused copy - one wording, so every button fails the same way. */
export const COPY_FAILED = 'Could not copy'

export const COPY_FAILED_DESCRIPTION = 'Your browser blocked clipboard access. Select the text and copy it by hand.'
