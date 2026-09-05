'use client'

import { useState, type FormEvent } from 'react'

import Link from 'next/link'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

import { Button } from '@/features/nexacrm/components/ui/button'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { siteConfig } from '@/lib/site-config'

import { login } from '../auth-service'

type LoginFormState = {
  email: string
  password: string
  rememberMe: boolean
}

const initialFormState: LoginFormState = {
  email: '',
  password: '',
  rememberMe: false
}

export function LoginForm() {
  const [formState, setFormState] = useState(initialFormState)
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setSubmitError(null)

    try {
      await login(formState)

      // A fresh document cannot retain the previous account's in-memory stores.
      window.location.assign(siteConfig.authenticatedHome)
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error ? error.message : 'Unable to sign in. Please try again.'

      setSubmitError(message)
      setPending(false)
    }
  }

  return (
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
          disabled={pending}
          value={formState.email}
          onInput={event => {
            const email = event.currentTarget.value
            setFormState(current => ({
              ...current,
              email
            }))
          }}
        />
      </div>

      <div className='grid gap-2'>
        <div className='flex items-center justify-between gap-2'>
          <Label htmlFor='password'>Password</Label>
          <Button
            variant='link'
            nativeButton={false}
            className='h-auto p-0 text-xs font-normal'
            render={
              <Link
                href={
                  formState.email
                    ? `/forgot-password?email=${encodeURIComponent(formState.email)}`
                    : '/forgot-password'
                }
              />
            }
          >
            Forgot password?
          </Button>
        </div>
        <div className='relative'>
          <Input
            id='password'
            name='password'
            type={passwordVisible ? 'text' : 'password'}
            autoComplete='current-password'
            placeholder='Enter your password'
            required
            disabled={pending}
            className='pr-8'
            value={formState.password}
            onInput={event => {
              const password = event.currentTarget.value
              setFormState(current => ({
                ...current,
                password
              }))
            }}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='absolute top-1/2 right-0.5 -translate-y-1/2'
            disabled={pending}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
            aria-controls='password'
            onClick={() => setPasswordVisible(current => !current)}
          >
            {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <Checkbox
          id='remember-me'
          checked={formState.rememberMe}
          disabled={pending}
          onCheckedChange={checked =>
            setFormState(current => ({
              ...current,
              rememberMe: checked === true
            }))
          }
        />
        <Label htmlFor='remember-me' className='text-sm font-normal'>
          Remember me
        </Label>
      </div>

      {submitError ? (
        <p id='login-error' className='text-destructive text-sm' role='alert'>
          {submitError}
        </p>
      ) : null}

      <Button type='submit' size='lg' disabled={pending} className='mt-2 w-full'>
        {pending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
