# Payroll email delivery

The API queues payslips; a separate worker generates their PDFs and sends them.
From `odoo-server`, start PostgreSQL and Redis, then use either:

```sh
npm run dev:all
```

or, with the API already running, start just the email worker:

```sh
npm run worker:payroll
```

For a production build, run `npm run build`, then supervise `npm start` and
`npm run worker:payroll:prod` as separate long-lived processes. `dev:all` stops
both development processes when either exits or when you press Ctrl-C. Existing
`dev`, `start`, image-deletion and attendance-worker commands are unchanged.

The worker loads the existing `.env`. Required SMTP settings are `SMTP_HOST`,
`SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL` (defaults to `SMTP_USER`).
Set `SMTP_PORT` and `SMTP_SECURE` to match the provider. Optional settings are
`SMTP_FROM_NAME`, `SMTP_MAX_CONNECTIONS`, and `SMTP_MESSAGES_PER_SECOND`.
Redis connections respect the full `REDIS_URL`, including database, credentials,
and TLS. No credentials are returned by the readiness endpoint.

The worker verifies SMTP before consuming jobs and publishes a readiness key
that expires after 20 seconds. The send API returns 503 while delivery is
unavailable or paused. The dialog refreshes readiness and per-recipient status.
A successful SMTP submission is shown as `sent`; this means the provider
accepted the message, not proof of final inbox delivery.

Temporary explicit SMTP rejections retry up to three attempts with exponential
backoff. Permanent rejections fail immediately. An ambiguous connection close or
worker crash during sending is marked for review instead of automatically
sending another copy. Confirm the recipient's inbox before an explicit resend.
The existing delivery `job_id` binds state updates to one attempt; stale jobs
cannot overwrite newer attempts. Recovery checks Redis state before releasing
abandoned records and leaves waiting, paused, active and delayed jobs intact.

Send actions retain `payslip:send` permission and finalized-payroll requirements.
Recipient selection is validated before dispatch. Client selections larger than
500 are sent in batches, and server-side Send all reads every page. Opening or
refreshing the delivery dialog never sends email.

## Verification

```sh
npm run test:mail
```

Requires local PostgreSQL and Docker with the `redis:7-alpine` image. It creates
and drops a uniquely named test database and Redis container, uses only a local
SMTP capture server, and does not change the demo data or use real SMTP. It
checks startup/authentication failure, availability, role checks, PDF attachment
contents, status reads, duplicate requests, stale jobs, SMTP rejection/retry,
uncertain delivery outcomes, all 505 recipients, selection validation and
shutdown. The test cleans up its processes and data even on failure.
