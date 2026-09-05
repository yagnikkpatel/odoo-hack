/**
 * The count line shown under every table - "302 employees", "583 attendance records",
 * "1 contract". Keep every table footer on this helper so the wording stays identical.
 */
export const formatRecordCount = (count: number, noun: string, nounPlural = `${noun}s`) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? noun : nounPlural}`
