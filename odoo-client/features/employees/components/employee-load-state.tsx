import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'

export default function EmployeeLoadState({
  error,
  onRetry,
}: {
  error?: string | null
  onRetry: () => void
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center gap-3 px-4 py-16 text-center"
      >
        <p className="font-medium">Employee could not be loaded</p>
        <p className="text-muted-foreground max-w-md text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }
  return (
    <div
      role="status"
      className="text-muted-foreground flex flex-1 items-center justify-center gap-2 py-16 text-sm"
    >
      <LoaderCircleIcon className="size-5 animate-spin" /> Loading employee...
    </div>
  )
}
