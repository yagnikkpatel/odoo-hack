# Password reset OTP

A reset code is generated per request and mailed over SMTP. There is no fixed
or configurable code; the previous `PASSWORD_RESET_OTP` variable is gone, and an
`.env` that still sets it is simply ignored.

## Flow

1. `POST /api/auth/forgot-password` looks the address up. An unknown address is
   accepted without issuing anything, so the response cannot be used to discover
   which addresses are registered.
2. A six-digit code is drawn from the CSPRNG. Only its SHA-256 digest, salted
   with the address, is written to Redis under `password-reset:otp:<email>`;
   whoever reads that key cannot turn it back into a usable code.
3. The plaintext code goes to the `auth-email` BullMQ queue, and the auth email
   worker sends it. If the code cannot be queued, it is deleted again rather
   than left behind where the user has no way of learning it, and the request
   returns 503.
4. `POST /api/auth/verify-otp` compares digests in constant time and exchanges a
   correct code for a single-use reset token.
5. `POST /api/auth/reset-password` sets the password, revokes every refresh
   session, and clears the cached user.

The code is never written to the logs.

## Limits

`PASSWORD_RESET_OTP_MAX_ATTEMPTS` (default 5) wrong guesses discard the code, so
guessing costs a new email rather than more tries. The counter is incremented
before the comparison, and shares the code's lifetime.

`PASSWORD_RESET_RESEND_COOLDOWN_SECONDS` (default 60) throttles resends. The
cooldown is claimed with `SET NX`, so two concurrent requests cannot both win
it and a held-down resend button costs one email. Verifying a code releases the
cooldown along with the code and its attempt counter.

`PASSWORD_RESET_OTP_TTL_SECONDS` and `PASSWORD_RESET_TOKEN_TTL_SECONDS` (both
default 600) bound the code and the reset token.

## Running it

The API queues; a worker sends. From `odoo-server`, with PostgreSQL and Redis
up:

```sh
npm run dev:all
```

That starts the API, the payslip email worker, and the auth email worker
together. With the API already running, start just this worker:

```sh
npm run worker:auth
```

For a production build, run `npm run build` and supervise
`npm run worker:auth:prod` as its own long-lived process. Without the worker,
reset requests are accepted and queued but no code is delivered.

SMTP settings are shared with payslip delivery -- see
[MAILING.md](MAILING.md). `SMTP_HOST`, `SMTP_USER`,
`SMTP_PASSWORD` and `SMTP_FROM_EMAIL` are required; the worker verifies them
before consuming any job, so a bad configuration fails at startup instead of
burning the retry budget of codes already waiting. Retries are spaced to finish
well inside the code's own lifetime, and a completed job is dropped from Redis
at once so no live code lingers in the queue.

## Verification

```sh
npm run test:password-reset
```

Requires the development PostgreSQL and Redis. It uses Redis database 9 and an
SMTP sink on loopback -- never real SMTP -- and creates and removes one
throwaway user, leaving demo data untouched. It checks silent handling of an
unknown address, that a random code is mailed and stored only as a hash, the
resend cooldown, lockout after the attempt limit, that a fresh code verifies
once, and that the reset token is single use and the new password logs in.
