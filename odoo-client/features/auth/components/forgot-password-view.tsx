'use client'

import { useState, type FormEvent } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { ApiError } from '@/lib/api-client'

import { requestPasswordReset } from '../auth-service'
import { AuthLayout } from './auth-layout'

export function ForgotPasswordView({ initialEmail = '' }: { initialEmail?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState(initialEmail)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)

    try {
      await requestPasswordReset({ email })
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
    } catch (cause) {
      const message =
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'Unable to request a recovery code. Please try again.'

      setError(message)
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title='Reset your password'
      subtitle='Enter the email on your account and we’ll issue a six-digit recovery code.'
      footer={
        <>
          Remembered it?{' '}
          <Button variant='link' nativeButton={false} className='h-auto p-0 text-sm' render={<Link href='/login' />}>
            Back to sign in
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className='flex flex-col gap-4' aria-busy={pending}>
        <div className='grid gap-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            name='email'
            type='email'
            autoComplete='email'
            placeholder='you@company.com'
            required
            autoFocus
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'forgot-password-error' : undefined}
            value={email}
            onInput={event => setEmail(event.currentTarget.value)}
          />
        </div>

        {error ? (
          <p id='forgot-password-error' className='text-destructive text-sm' role='alert'>
            {error}
          </p>
        ) : null}

        <Button type='submit' size='lg' disabled={pending} className='mt-2 w-full'>
          {pending ? 'Sending code…' : 'Send recovery code'}
        </Button>
      </form>
    </AuthLayout>
  )
}
