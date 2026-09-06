import Link from 'next/link'
import type { ReactNode } from 'react'

/** Keep record labels visible without offering routes the viewer cannot open. */
export default function AccessLink({ allowed, href, className, children }: {
  allowed: boolean
  href: string
  className?: string
  children: ReactNode
}) {
  return allowed ? <Link href={href} className={className}>{children}</Link> : <span className={className?.replace(/hover:[^ ]+/g, '')}>{children}</span>
}
