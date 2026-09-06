# Database seeds

Run commands from `odoo-server` with `.env` configured. Apply the current schema
first:

```sh
npm run migrate
```

For individual modules, run these in dependency order:

```sh
npm run seed             # Admin from SEED_ADMIN_* environment variables
npm run seed:dummy       # Employee accounts and profiles
npm run seed:contracts   # Contracts plus contract_history creation entries
npm run seed:attendance  # Attendance for existing employees
npm run seed:time-off    # Leave types, allocations, requests and decision history
npm run seed:payroll     # Salary rules and structures, including quantity/active
```

The admin, dummy-user and payroll seeds reuse existing records. The contracts
and time-off seeds add sample records on each run. Attendance skips existing
employee/date pairs. Payroll seeding restores the sample rules and structure
memberships; it does not generate payslips.

For a complete demo, use `npm run seed:demo` instead. **This clears existing
application data**, including contract history, and rebuilds accounts, profiles,
contracts, audit entries, attendance, time off, payroll and delivery records.
It requires PostgreSQL and Redis. Payroll is computed through the application
service. Seeded contract history uses the current snapshot format and a null
actor to identify script-generated records.

The optional `node scripts/seed-time-off.cjs` seeds through a running API instead
of direct SQL. It uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, skips when
leave types exist, and accepts `--reset` to delete the existing time-off data.
