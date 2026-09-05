'use client'

// React Imports
import { useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'

// Third-party Imports
import { AlertCircleIcon, CheckCircle2Icon, FileTextIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/features/nexacrm/components/ui/dialog'
import { Label } from '@/features/nexacrm/components/ui/label'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/features/nexacrm/components/ui/table'

// Util Imports
import { parseCsv } from '@/features/nexacrm/utils/csv'
import { cn } from '@/features/nexacrm/lib/utils'

export type ImportField = {
  /** Key on the module's input type - also the key in the record handed to `parseRow`. */
  key: string
  label: string

  /** A row missing this is rejected; the step cannot be left until the field is mapped. */
  required?: boolean

  aliases?: string[]
}

/** A row either converts to the module's input type, or explains why it did not. */
export type ParsedRow<TInput> = { ok: true; input: TInput } | { ok: false; error: string }

type ImportDialogProps<TInput> = {
  open: boolean
  onOpenChange: (open: boolean) => void

  /** Used throughout the copy: `{ singular: 'company', plural: 'companies' }`. */
  entity: { singular: string; plural: string }
  fields: ImportField[]

  /** Validates + converts ONE mapped row. The module owns this so its Zod schema stays with it. */
  parseRow: (values: Record<string, string>) => ParsedRow<TInput>

  /** Commit. Called once with every valid row - modules add in bulk, not row by row. */
  onImport: (inputs: TInput[]) => void
}

/** Header ↔ field matching ignores case, spaces and punctuation: "Job title" === "job_title". */
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The Select value standing in for "this field is not in the file" - Base UI needs a real string. */
const UNMAPPED = '__unmapped__'

const ROWS_PREVIEWED = 8
const ERRORS_LISTED = 6

const ImportDialog = <TInput,>({
  open,
  onOpenChange,
  entity,
  fields,
  parseRow,
  onImport
}: ImportDialogProps<TInput>) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])

  /** field key → CSV column index. Absent means "not imported". */
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [readError, setReadError] = useState('')

  const step = headers.length === 0 ? 'upload' : 'map'

  const reset = () => {
    setFileName('')
    setHeaders([])
    setRows([])
    setMapping({})
    setReadError('')
    setIsDragging(false)
  }

  const close = () => {
    onOpenChange(false)

    setTimeout(reset, 200)
  }

  const readFile = async (file: File) => {
    setReadError('')

    if (!/\.csv$/i.test(file.name)) {
      setReadError('That is not a .csv file.')

      return
    }

    const parsed = parseCsv(await file.text())

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setReadError('That file has no data rows.')

      return
    }

    const auto: Record<string, number> = {}

    fields.forEach(field => {
      const candidates = [field.label, field.key, ...(field.aliases ?? [])].map(normalise)
      const index = parsed.headers.findIndex(header => candidates.includes(normalise(header)))

      if (index >= 0) auto[field.key] = index
    })

    setFileName(file.name)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(auto)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]

    if (file) void readFile(file)
  }

  const missingRequired = fields.filter(field => field.required && mapping[field.key] === undefined)

  const results = useMemo(() => {
    if (missingRequired.length > 0) return []

    return rows.map((row, index) => {
      const values: Record<string, string> = {}

      fields.forEach(field => {
        const column = mapping[field.key]

        values[field.key] = column === undefined ? '' : (row[column] ?? '')
      })

      return { line: index + 2, result: parseRow(values) }
    })
  }, [rows, mapping, fields, parseRow, missingRequired.length])

  const valid = results.filter(entry => entry.result.ok)
  const invalid = results.filter(entry => !entry.result.ok)

  const commit = () => {
    onImport(valid.map(entry => (entry.result as { ok: true; input: TInput }).input))

    toast.success(
      `Imported ${valid.length} ${valid.length === 1 ? entity.singular : entity.plural}`,
      invalid.length > 0 ? { description: `${invalid.length} row(s) were skipped.` } : undefined
    )

    close()
  }

  const mappedFields = fields.filter(field => mapping[field.key] !== undefined)

  return (
    <Dialog open={open} onOpenChange={next => (next ? onOpenChange(true) : close())}>
      <DialogContent className='flex max-h-[85dvh] flex-col sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Import {entity.plural}</DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Upload a CSV file. The first row must be a header row.'
              : `Match each column in ${fileName} to a field. Unmatched fields are left empty.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className='min-h-0 flex-1 space-y-3 overflow-y-auto'>
            <input
              ref={inputRef}
              type='file'
              accept='.csv,text/csv'
              className='sr-only'
              onChange={event => {
                const file = event.target.files?.[0]

                if (file) void readFile(file)

                event.target.value = ''
              }}
            />

            <div
              onDragOver={event => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              <div className='bg-muted flex size-10 items-center justify-center rounded-full'>
                <UploadIcon className='text-muted-foreground size-5' />
              </div>
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Drop a CSV file here</p>
                <p className='text-muted-foreground text-xs'>or pick one from your computer</p>
              </div>
              <Button variant='outline' size='sm' onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>
            </div>

            {readError ? (
              <p className='text-destructive flex items-center gap-1.5 text-sm'>
                <AlertCircleIcon className='size-4 shrink-0' /> {readError}
              </p>
            ) : null}
          </div>
        ) : (
          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto pr-1'>
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <FileTextIcon className='size-4 shrink-0' />
              <span className='truncate'>{fileName}</span>
              <Badge variant='outline' className='ml-auto shrink-0 tabular-nums'>
                {rows.length} rows
              </Badge>
            </div>

            <div>
              <div className='grid gap-3 sm:grid-cols-2'>
                {fields.map(field => (
                  <div key={field.key} className='space-y-1.5'>
                    <Label className='text-xs'>
                      {field.label}
                      {field.required ? <span className='text-destructive ml-0.5'>*</span> : null}
                    </Label>
                    <SearchableSelect
                      label={`${field.label} column`}
                      options={[
                        { label: 'Do not import', value: UNMAPPED },
                        ...headers.map((header, index) => ({ label: header, value: String(index) }))
                      ]}
                      value={mapping[field.key] === undefined ? UNMAPPED : String(mapping[field.key])}
                      onChange={value =>
                        setMapping(current => {
                          const next = { ...current }

                          if (value === UNMAPPED) delete next[field.key]
                          else next[field.key] = Number(value)

                          return next
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {missingRequired.length > 0 ? (
              <p className='text-destructive flex items-center gap-1.5 text-sm'>
                <AlertCircleIcon className='size-4 shrink-0' />
                Map a column to {missingRequired.map(field => field.label).join(' and ')} to continue.
              </p>
            ) : (
              <div className='space-y-3'>
                <div className='flex flex-wrap items-center gap-3 text-sm'>
                  <span className='flex items-center gap-1.5'>
                    <CheckCircle2Icon className='size-4 shrink-0 text-emerald-600' />
                    <span className='tabular-nums'>{valid.length}</span> ready to import
                  </span>
                  {invalid.length > 0 ? (
                    <span className='text-muted-foreground flex items-center gap-1.5'>
                      <AlertCircleIcon className='size-4 shrink-0' />
                      <span className='tabular-nums'>{invalid.length}</span> will be skipped
                    </span>
                  ) : null}
                </div>

                {valid.length > 0 ? (
                  <div className='overflow-x-auto rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {mappedFields.map(field => (
                            <TableHead key={field.key} className='whitespace-nowrap'>
                              {field.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {valid.slice(0, ROWS_PREVIEWED).map(entry => (
                          <TableRow key={entry.line}>
                            {mappedFields.map(field => (
                              <TableCell key={field.key} className='max-w-40 truncate whitespace-nowrap'>
                                {String(
                                  (entry.result as { ok: true; input: TInput }).input[field.key as keyof TInput] ?? ''
                                ) || <span className='text-muted-foreground'>-</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {invalid.length > 0 ? (
                  <ul className='text-muted-foreground space-y-0.5 text-xs'>
                    {invalid.slice(0, ERRORS_LISTED).map(entry => (
                      <li key={entry.line}>
                        Line {entry.line}: {(entry.result as { ok: false; error: string }).error}
                      </li>
                    ))}
                    {invalid.length > ERRORS_LISTED ? <li>…and {invalid.length - ERRORS_LISTED} more.</li> : null}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={close}>
            Cancel
          </Button>
          {step === 'map' ? (
            <Button onClick={commit} disabled={valid.length === 0}>
              Import {valid.length > 0 ? valid.length : ''} {valid.length === 1 ? entity.singular : entity.plural}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ImportDialog
