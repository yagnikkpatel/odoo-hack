'use client'

import { useId, useState } from 'react'
import type { ChangeEvent } from 'react'
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { useEmployeePermissions } from '../permissions'
import { useEmployeesStore } from '../store'
import type { Employee, EmployeeImageType } from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function ImageControl({
  employeeId,
  imageType,
  label,
  imageUrl,
}: {
  employeeId: string
  imageType: EmployeeImageType
  label: string
  imageUrl?: string
}) {
  const inputId = useId()
  const [pending, setPending] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uploadImages = useEmployeesStore((state) => state.uploadImages)
  const deleteImage = useEmployeesStore((state) => state.deleteImage)

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || pending) return
    setError(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Choose an image smaller than 5 MB.')
      return
    }
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError('Choose a JPEG, PNG, or WebP image.')
      return
    }

    let fieldName = 'employeeImage'
    if (imageType === 'company') fieldName = 'companyImage'
    const data = new FormData()
    data.append(fieldName, file)
    setPending(true)
    try {
      await uploadImages(employeeId, data)
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
      else setError('The image could not be uploaded. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await deleteImage(employeeId, imageType)
      setConfirmRemove(false)
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
      else setError('The image could not be removed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2 py-2" aria-busy={pending}>
      <div className="flex items-center gap-2">
        <PersonAvatar name={label} src={imageUrl} />
        <Label htmlFor={inputId} className="flex-1">
          {label}
        </Label>
        {imageUrl && !confirmRemove && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${label.toLowerCase()}`}
            disabled={pending}
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2Icon className="text-muted-foreground" />
          </Button>
        )}
      </div>
      <Input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending || confirmRemove}
        onChange={(event) => void upload(event)}
        className="text-xs"
      />
      {pending && (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          <LoaderCircleIcon className="size-3 animate-spin" /> Saving image...
        </p>
      )}
      {confirmRemove && (
        <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-xs">
          <p>Remove this {label.toLowerCase()}?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export default function ProfileImages({ employee }: { employee: Employee }) {
  const { canUpdate } = useEmployeePermissions()
  if (!canUpdate) return null

  return (
    <RecordGroup title="Images">
      <p className="text-muted-foreground text-xs">
        JPEG, PNG, or WebP. Up to 5 MB per image.
      </p>
      <ImageControl
        employeeId={employee.id}
        imageType="employee"
        label="Employee photo"
        imageUrl={employee.avatar}
      />
      <ImageControl
        employeeId={employee.id}
        imageType="company"
        label="Company logo"
        imageUrl={employee.companyImage}
      />
    </RecordGroup>
  )
}
