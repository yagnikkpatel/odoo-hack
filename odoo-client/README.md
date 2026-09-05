# PeoplePay360 Client

Next.js frontend for PeoplePay360. Authentication uses the real backend; business-data APIs are not connected yet.

## Run locally

1. Install dependencies with `pnpm install`.
2. Set `BACKEND_API_URL` in `.env.local` if the backend is not at `http://localhost:4000/api`.
3. Start the backend using its own project instructions, then run `pnpm dev` in this directory.
4. Open `/login` and use an existing backend account. A successful login opens `/employees`.

`BACKEND_API_URL` is server-only. Do not prefix it with `NEXT_PUBLIC_`, copy backend secrets into this client, or put access tokens in local/session storage.

## Authentication

The browser talks only to same-origin Next.js auth routes. Those routes call the configured backend under `/api/auth`.

| Frontend endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login` | Validates credentials with the backend, verifies the returned identity, and sets an HTTP-only session cookie |
| `GET /api/auth/session` | Verifies the session with backend `GET /api/auth/me` and returns the current public user profile |
| `POST /api/auth/logout` | Clears the session and password-recovery cookies |
| `POST /api/auth/forgot-password` | Requests a recovery code using the existing backend flow |
| `POST /api/auth/verify-otp` | Verifies the code and retains the short-lived reset token in an HTTP-only cookie |
| `POST /api/auth/reset-password` | Sends the new password and cookie-held reset token to the backend |

The auth-only backend addition, `GET /api/auth/me`, uses the existing JWT middleware and reads the current account from the database. Deleted/inactive accounts cannot establish a frontend session. Sidebar identity comes from this verified account; no demo admin or role switcher remains.

Protected layouts verify sessions server-side. The routing proxy checks cookie presence before preserving the existing module-availability redirects; cookie presence alone is not authentication. The native client session guard also checks on focus and periodically, so expiry or a changed account in another tab does not leave a stale authenticated layout. Backend outages show a retry state instead of silently using a fake identity or treating every failure as a logout.

Login and logout use full-document navigation to discard the previous account's in-memory records. Auth POST routes require the application's origin. Cookies are HTTP-only, SameSite=Lax, and Secure in production; responses are not cached. Neither access tokens nor password-reset tokens are exposed in browser JSON.

“Remember me” persists the cookie only until the access token expires. The backend currently has no refresh-token endpoint, so this option does not promise a 30-day login. Password recovery uses the backend's configured development OTP, stored in Redis and written to backend logs. **No recovery email is sent.** Obtain the code from the backend administrator; never expose backend configuration or OTPs through a frontend endpoint. Random per-request codes and a real delivery provider are required before production use.

## No generated business data

Production fake databases, HR/demo hydrators, synthetic attendance and leave generators, sample contracts, seeded salary rules/structures, generated dashboard figures and fake email-send success have been removed. Explicit regression fixtures live under `scripts/fixtures/` only and are never imported by application code.

`features/nexacrm/providers/app-records-provider.tsx` supplies the verified current account and empty CRM stores. `features/hr/data-stores-initializer.tsx` resolves Employees, Contracts, Attendance, Working Schedules and Time Off loading states with empty collections. Payroll also starts empty. KPI cards show unavailable values where the data API is disconnected, not fabricated metrics.

`features/hr/data-availability.ts` keeps business writes unavailable. Shared permission checks hide unconnected create/edit/import/approval actions, and HR/payroll store boundaries reject disconnected writes. Do not simply turn this flag on: replace local mutations with authenticated real API calls, loading/error handling, server-enforced permissions and request reconciliation first.

Only auth is connected in this phase. No employee, contract, attendance, leave or payroll API has been connected; no database seeds or migrations were run. Existing sidebar visibility/module redirects remain unchanged.

## UI structure

- `features/auth/`: login/recovery UI, browser auth service, server session verification, validated auth bridge and session guard.
- `components/layout/`: authenticated shell, collapsible sidebar, verified identity and working sign-out menu.
- `features/employees/`, `features/contracts/`: directory, employment agreements, tables, panels and details ready for real records.
- `features/attendance/`, `features/working-schedules/`: retained table/calendar/schedule UI and validation logic.
- `features/time-off/`: connected leave type/allocation/request domain logic and shared list/detail UI; no seeded balances or requests.
- `features/payroll/`: retained configuration, payrun, payslip and reporting UI/logic without default salary data.
- `features/nexacrm/`: reusable extracted template components and native React state/query adapters; non-auth service adapters return typed empty collections until their APIs are implemented.

The existing light Modern Minimal blue theme, login backdrop/hover treatment, colorful navigation icons, searchable selectors and themed date/time inputs are preserved. No Zod, React Hook Form, Zustand or nuqs dependency was added to the frontend.

## Verification

- `pnpm test:auth:live`: checks every auth route on the already-running local frontend, without credentials, mocks, account changes or starting a server. It catches missing routes/HTML 404s that handler-level tests cannot. This is a routing smoke test, not proof of a completed password reset.
- `node scripts/test-auth.mjs`: auth payloads, origin checks, cookie lifetimes, malformed upstream responses, session errors, logout and recovery.
- `node scripts/test-auth-integration.mjs`: protected-layout wiring, real identity, logout/session guard and absence of runtime demo entry points.
- `node scripts/test-no-template-demo.mjs`: empty CRM services, removed fake databases, empty dashboard data and disabled fake email sending.
- Domain regression scripts under `scripts/` exercise pure logic against test-only fixtures and separately check disconnected runtime writes.
- `pnpm exec tsc --noEmit`, targeted ESLint and `pnpm build` check integration.
- Backend `node scripts/test-auth-me.cjs` verifies current-account lookup and authentication middleware without changing a real account.

Historical `verify-*-source.mjs` template snapshots intentionally detect differences where this request removed fake content. Their allowlists were not loosened to hide those changes.

If a newly added auth route returns HTML 404 even though its file exists and the build includes it, restart the existing Next development server to refresh route registration, then run `pnpm test:auth:live`. Do not treat a successful backend-only OTP request or a mocked handler test as a successful browser recovery flow.
