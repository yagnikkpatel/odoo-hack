type CsvRow = Record<string, string | number | undefined>

const escapeCell = (value: string | number | undefined): string => {
  const text = value === undefined ? '' : String(value)

  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const downloadCsv = (filename: string, rows: CsvRow[]): void => {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const lines = [headers.join(','), ...rows.map(row => headers.map(header => escapeCell(row[header])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Case-, space- and punctuation-insensitive, matching how the import dialog pairs headers to fields. */
const normaliseName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export const nameMatcher = <T>(
  records: readonly T[],
  nameOf: (record: T) => string,
  idOf: (record: T) => string
): ((raw: string) => string | undefined) => {
  const byName = new Map<string, string>()

  records.forEach(record => {
    const key = normaliseName(nameOf(record))

    if (key && !byName.has(key)) byName.set(key, idOf(record))
  })

  return raw => (raw.trim() ? byName.get(normaliseName(raw)) : undefined)
}

export type ParsedCsv = {
  headers: string[]

  /** Data rows, already padded/truncated to `headers.length` so `row[i]` always pairs with `headers[i]`. */
  rows: string[][]
}

export const parseCsv = (text: string): ParsedCsv => {
  const table: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const source = text.replace(/^﻿/, '')

  const endCell = () => {
    row.push(cell)
    cell = ''
  }

  const endRow = () => {
    endCell()

    if (row.some(value => value.trim() !== '')) table.push(row)
    row = []
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]

    if (quoted) {
      if (char !== '"') {
        cell += char
      } else if (source[index + 1] === '"') {
        cell += '"'
        index++
      } else {
        quoted = false
      }

      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') endCell()
    else if (char === '\n') endRow()
    else if (char !== '\r') cell += char
  }

  if (cell !== '' || row.length > 0) endRow()

  const [headers = [], ...rest] = table

  return {
    headers: headers.map(header => header.trim()),

    rows: rest.map(values => Array.from({ length: headers.length }, (_, index) => (values[index] ?? '').trim()))
  }
}
