'use client'

import { useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/features/nexacrm/components/ui/dialog'
import { requestPasswordReset, verifyPasswordResetOtp, resetPassword } from '../auth-service'

export function PasswordRecovery({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'complete'>('email')
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (step === 'password' && newPassword !== confirmPassword) {
      setError('Passwords must match.')
      return
    }
    setPending(true)
    try {
      if (step === 'email') {
        await requestPasswordReset({ email })
        setStep('code')
      } else if (step === 'code') {
        await verifyPasswordResetOtp({ email, otp })
        setOtp('')
        setStep('password')
      } else if (step === 'password') {
        await resetPassword({ newPassword, confirmPassword })
        setNewPassword('')
        setConfirmPassword('')
        setStep('complete')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete password recovery.')
    } finally {
      setPending(false)
    }
  }

  const descriptions = {
    email: 'Enter your account email to request a password recovery code.',
    code: 'If this account exists, a recovery code has been issued. Contact your administrator if you cannot receive it.',
    password: 'Choose a new password of 8–72 characters. Your recovery session expires shortly.',
    complete: 'Your password has been changed. Sign in using your new password.'
  }
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent className='sm:max-w-md' showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{step === 'complete' ? 'Password updated' : 'Reset password'}</DialogTitle>
          <DialogDescription>{descriptions[step]}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='grid gap-4' aria-busy={pending}>
          {step === 'email' && (
            <div className='grid gap-2'>
              <Label htmlFor='recovery-email'>Account email</Label>
              <Input
                id='recovery-email'
                type='email'
                required
                autoComplete='email'
                autoFocus
                disabled={pending}
                value={email}
                onInput={event => setEmail(event.currentTarget.value)}
              />
            </div>
          )}
          {step === 'code' && (
            <div className='grid gap-2'>
              <p className='text-muted-foreground text-xs break-all'>{email}</p>
              <Label htmlFor='recovery-code'>Recovery code</Label>
              <Input
                id='recovery-code'
                inputMode='numeric'
                pattern='[0-9]{6}'
                maxLength={6}
                minLength={6}
                required
                autoComplete='one-time-code'
                autoFocus
                disabled={pending}
                value={otp}
                onInput={event => setOtp(event.currentTarget.value)}
              />
            </div>
          )}
          {step === 'password' && (
            <>
              <div className='grid gap-2'>
                <Label htmlFor='recovery-password'>New password</Label>
                <Input
                  id='recovery-password'
                  type='password'
                  minLength={8}
                  maxLength={72}
                  required
                  autoComplete='new-password'
                  autoFocus
                  disabled={pending}
                  value={newPassword}
                  onInput={event => setNewPassword(event.currentTarget.value)}
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='recovery-confirm'>Confirm password</Label>
                <Input
                  id='recovery-confirm'
                  type='password'
                  minLength={8}
                  maxLength={72}
                  required
                  autoComplete='new-password'
                  disabled={pending}
                  value={confirmPassword}
                  onInput={event => setConfirmPassword(event.currentTarget.value)}
                />
              </div>
            </>
          )}
          {error && (
            <p className='text-destructive text-sm' role='alert'>
              {error}
            </p>
          )}
          <DialogFooter>
            {step === 'complete' ? (
              <Button type='button' onClick={onClose}>
                Back to sign in
              </Button>
            ) : (
              <>
                <Button type='button' variant='outline' disabled={pending} onClick={onClose}>
                  Cancel
                </Button>
                <Button type='submit' disabled={pending}>
                  {pending
                    ? 'Please wait…'
                    : step === 'email'
                      ? 'Request code'
                      : step === 'code'
                        ? 'Verify code'
                        : 'Update password'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
