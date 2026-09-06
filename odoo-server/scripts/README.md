# Database seed

From `odoo-server`, configure `.env`, then run:

```sh
npm run migrate
npm run seed
```

`npm run seed` is the single complete demo seed. `seed:demo` is a compatibility
alias for that same command. The old individual module seeds have been removed.

The seed clears all application records and rebuilds users, profiles, contracts
and their history, attendance, leave types/allocations/requests, salary rules,
structures, bank accounts, payruns and computed payslips. Migration-owned roles,
permissions and schema are preserved. PostgreSQL and Redis must be running.
Stop email workers before resetting; an active delivery makes the seed abort.

Payroll runs through the real compute/validate/pay services. Historical months
are paid, the second-most-recent month is validated, the last completed month is
computed, and the current month is draft. All payroll participants have complete
bank details, one applicable running contract and settled attendance. Salary
structures contain their formula dependencies. The seed fails on payroll
warnings rather than hiding or deleting warnings from computed records.

No email deliveries or sent/failed/queued statuses are fabricated. Existing
payslip email jobs, application caches and login sessions are cleared during the
reset. Other workers' queues are left alone. The seed never sends email.

All demo accounts use `SEED_DEMO_PASSWORD` (default `00000000`). Sign in again
after reseeding. Login addresses include `admin@peoplepay360.com`,
`hr@peoplepay360.com`, `payroll@peoplepay360.com`,
`payroll.user@peoplepay360.com` and `employee@peoplepay360.com`.
