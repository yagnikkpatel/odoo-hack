'use client'

import { useState, type FormEvent } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { MailIcon } from 'lucide-react'

import { Button } from '@/features/nexacrm/components/ui/button'
import { Label } from '@/features/nexacrm/components/ui/label'
import { ApiError } from '@/lib/api-client'

import { requestPasswordReset, verifyPasswordResetOtp } from '../auth-service'
import { AuthCircleIcon, AuthLayout } from './auth-layout'
import { OtpInput } from './otp-input'

const OTP_LENGTH = 6

export function VerifyOtpView({ email }: { email: string }) {
  const router = useRouter()
  const [otp, setOtp] = useState('')
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const busy = pending || resending

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit recovery code.`)
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)

    try {
      await verifyPasswordResetOtp({ email, otp })
      // The reset token now lives in an httpOnly cookie, so the next step needs no state.
      router.push('/reset-password')
    } catch (cause) {
      const message =
        cause instanceof ApiError || cause instanceof Error ? cause.message : 'Unable to verify the recovery code.'

      setError(message)
      setOtp('')
      setPending(false)
    }
  }

  const resend = async () => {
    if (busy) return
    setResending(true)
    setError(null)
    setNotice(null)

    try {
      await requestPasswordReset({ email })
      setOtp('')
      setNotice('A new recovery code has been issued. The previous code no longer works.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to resend the recovery code.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      mark={<AuthCircleIcon icon={MailIcon} />}
      title='Enter your recovery code'
      subtitle={
        <>
          If an account exists for <span className='text-foreground font-medium break-all'>{email}</span>, a six-digit
          code has been issued. It expires shortly.
        </>
      }
      footer={
        <>
          Wrong address?{' '}
          <Button
            variant='link'
            nativeButton={false}
            className='h-auto p-0 text-sm'
            render={<Link href='/forgot-password' />}
          >
            Use a different one
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className='flex flex-col gap-4' aria-busy={pending}>
        <div className='grid gap-2'>
          <Label htmlFor='recovery-code'>Recovery code</Label>
          <OtpInput
            id='recovery-code'
            value={otp}
            onChange={setOtp}
            length={OTP_LENGTH}
            autoFocus
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'verify-otp-error' : undefined}
          />
        </div>

        {error ? (
          <p id='verify-otp-error' className='text-destructive text-sm' role='alert'>
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className='text-muted-foreground text-sm' role='status'>
            {notice}
          </p>
        ) : null}

        <div className='mt-2 flex flex-col gap-3'>
          <Button type='submit' size='lg' disabled={busy || otp.length !== OTP_LENGTH} className='w-full'>
            {pending ? 'Verifying…' : 'Verify code'}
          </Button>

          <Button type='button' variant='outline' size='lg' disabled={busy} className='w-full' onClick={resend}>
            {resending ? 'Sending…' : 'Resend code'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
