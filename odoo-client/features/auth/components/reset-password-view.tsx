'use client'

import { useState, type FormEvent } from 'react'

import Link from 'next/link'
import { CheckIcon } from 'lucide-react'

import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { ApiError } from '@/lib/api-client'

import { resetPassword } from '../auth-service'
import { AuthCircleIcon, AuthLayout } from './auth-layout'

export function ResetPasswordView() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    if (newPassword !== confirmPassword) {
      setError('Both passwords must match.')
      return
    }
    setPending(true)
    setError(null)

    try {
      await resetPassword({ newPassword, confirmPassword })
      setNewPassword('')
      setConfirmPassword('')
      setDone(true)
    } catch (cause) {
      const message =
        cause instanceof ApiError || cause instanceof Error ? cause.message : 'Unable to reset your password.'

      setError(message)
      setPending(false)
    }
  }

  if (done) {
    return (
      <AuthLayout
        mark={<AuthCircleIcon icon={CheckIcon} />}
        title='Password updated'
        subtitle='Your password has been changed and every other session was signed out. Sign in with your new password.'
      >
        <Button size='lg' nativeButton={false} className='w-full' render={<Link href='/login' />}>
          Back to sign in
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title='Set a new password'
      subtitle='Choose a password you don’t use anywhere else. Your recovery session expires shortly.'
      footer={
        <>
          Changed your mind?{' '}
          <Button variant='link' nativeButton={false} className='h-auto p-0 text-sm' render={<Link href='/login' />}>
            Back to sign in
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className='flex flex-col gap-4' aria-busy={pending}>
        <div className='grid gap-2'>
          <Label htmlFor='new-password'>New password</Label>
          <Input
            id='new-password'
            name='newPassword'
            type='password'
            autoComplete='new-password'
            minLength={8}
            maxLength={72}
            required
            autoFocus
            disabled={pending}
            aria-describedby='new-password-hint'
            value={newPassword}
            onInput={event => setNewPassword(event.currentTarget.value)}
          />
          <p id='new-password-hint' className='text-muted-foreground text-xs'>
            Between 8 and 72 characters.
          </p>
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='confirm-password'>Confirm new password</Label>
          <Input
            id='confirm-password'
            name='confirmPassword'
            type='password'
            autoComplete='new-password'
            minLength={8}
            maxLength={72}
            required
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'reset-password-error' : undefined}
            value={confirmPassword}
            onInput={event => setConfirmPassword(event.currentTarget.value)}
          />
        </div>

        {error ? (
          <p id='reset-password-error' className='text-destructive text-sm' role='alert'>
            {error}
          </p>
        ) : null}

        <Button type='submit' size='lg' disabled={pending} className='mt-2 w-full'>
          {pending ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
