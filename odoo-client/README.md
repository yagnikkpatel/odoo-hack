# PeoplePay360 Client

Next.js frontend for PeoplePay360. Authentication, Employees, Contracts, and Attendance Records use the real backend; other HR modules remain disconnected.

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

`features/nexacrm/providers/app-records-provider.tsx` supplies the verified current account and empty CRM stores. `features/hr/data-stores-initializer.tsx` resolves Working Schedules and Time Off with empty collections. Employees, Contracts, and Attendance load independently from their APIs. Payroll also starts empty. Employee KPI cards show database totals; missing numeric values use `0`, and missing text uses clear labels such as `Not set`.

`features/hr/data-availability.ts` keeps unconnected modules' writes unavailable. Employees, Contracts, and Attendance have independent API-backed stores and resource-specific permissions; connecting them does not enable other HR/payroll mutations. Do not simply turn the shared flag on: each module needs authenticated API calls, loading/error handling, server-enforced permissions and request reconciliation first.

Working schedules, leave, and payroll APIs remain disconnected; no database seeds or migrations were run. Existing sidebar visibility/module redirects remain unchanged.

## Employees

The browser calls same-origin `/api/employees` routes. The HTTP-only auth cookie stays server-side and the backend checks the current account's role/status before every employee action.

- The directory requests one page at a time with `limit`, `offset`, `search`, `department` and `role`. Search/filtering run on the server. Table and grid share pagination. KPI totals cover the full directory, independently of search filters.
- For admins, New employee first creates a login account with name, email, initial password and role through `/api/users`, then saves the work profile through `/api/employees/[userId]`. The confirmed account ID survives a profile failure or closing/reopening the dialog; a full page reload can recover the account through Link existing account. Credentials are never persisted in browser storage and no invitation email is sent.
- Linking an existing active account from `/api/employees/accounts` stays optional for admins and is the only creation path for HR roles. The server verifies the current admin role before forwarding account creation. Account identity is read-only in profile forms; the profile edits job position, department, contact, manager, schedule, company, work location and optional location.
- `GET`, `POST`, `PATCH` and `DELETE /api/employees/[userId]` load/save/delete profiles. The frontend uses that exact backend user ID and never creates IDs, timestamps, activity history or optimistic fake records. Profile deletion preserves the login account.
- `/api/employees/[userId]/images` and `/images/[imageType]` handle employee photos and company logos through the existing backend image service. JPEG, PNG and WebP are limited to 5 MB each. Cloudinary configuration and its deletion worker must be available for real image operations.
- Admin and the three HR roles can manage employee profiles. Ordinary employees see only their own profile. These UI rules mirror existing backend permissions; the API remains authoritative.
- CSV exports only the current page or explicitly selected records. Unsupported local CSV import and sorting were removed. Timeline and related modules clearly remain unconnected.

`features/employees/service.ts` handles requests, `employee-mapper.ts` maps backend responses, `store.ts` coordinates native React state, and `permissions.ts` controls employee-only UI actions. Failed writes retain the current record; stale requests cannot overwrite newer results.

## Contracts

The browser calls same-origin `/api/contracts` routes. The HTTP-only auth cookie remains on the server and is forwarded to the backend as a bearer token for each request.

- List requests use backend pagination and the supported `search`, `status`, and `employeeId` filters. Direct detail URLs fetch their record independently.
- Create sends only `employeeId`, required start/end dates, positive wage, and `running` or `expired` status. Update keeps `employeeId` immutable. Delete waits for backend confirmation.
- Responses are validated before entering UI state. The frontend does not generate contract IDs, timestamps, statuses, currency, salary structures, schedules, or other unsupported fields.
- Contract history requests every backend page for the selected employee. Admin and the three HR roles can manage contracts; ordinary employees have no contract access, matching backend migration 007.
- Payroll remains disabled and has a separate empty input boundary because the Contracts API does not provide payroll-only terms such as currency, wage period, salary structure, or working schedule.

`features/contracts/server.ts` protects the backend boundary, `service.ts` and `contract-mapper.ts` validate browser responses, `store.ts` reconciles list/detail mutations, and `permissions.ts` mirrors backend visibility rules.

## UI structure

- `features/auth/`: login/recovery UI, browser auth service, server session verification, validated auth bridge and session guard.
- `components/layout/`: authenticated shell, collapsible sidebar, verified identity and working sign-out menu.
- `features/employees/`: API-backed directory, profile forms, preview panel, detail pages and image controls.
- `features/contracts/`: API-backed employment agreement CRUD, tables, panels and detail/history views.
- `features/attendance/`: API-backed personal clock, record management, table/calendar and employee detail views.
- `features/working-schedules/`: retained disconnected schedule UI and validation logic.
- `features/time-off/`: connected leave type/allocation/request domain logic and shared list/detail UI; no seeded balances or requests.
- `features/payroll/`: retained configuration, payrun, payslip and reporting UI/logic without default salary data.
- `features/nexacrm/`: reusable extracted template components and native React state/query adapters; non-auth service adapters return typed empty collections until their APIs are implemented.

The existing light Modern Minimal blue theme, login backdrop/hover treatment, colorful navigation icons, searchable selectors and themed date/time inputs are preserved. No Zod, React Hook Form, Zustand or nuqs dependency was added to the frontend.

## Attendance records

The same-origin bridge forwards all nine record operations while keeping the session cookie server-side:

| Endpoint | Methods | Access |
| --- | --- | --- |
| `/api/attendance/me` | GET | Own paginated records |
| `/api/attendance/me/today` | GET | Own record for today, or null |
| `/api/attendance/check-in` | POST | Own check-in using server time |
| `/api/attendance/check-out` | POST | Own most recent open session within 24 hours |
| `/api/attendance` | GET, POST | Admin and HR roles: list or create records |
| `/api/attendance/[id]` | GET, PATCH, DELETE | Admin and HR roles: read, correct, delete |

The backend enforces authorization on every request. Employees use the own-list endpoint to resolve direct record links; they never call the manager-only detail endpoint. Search and employee filtering are available only in the all-records view. Status and date filters work in both scopes. Calendar and CSV fetch all matching pages instead of treating the table's current page as the full dataset.

Dates and timestamps display in `Asia/Kolkata`; writes carry explicit timezone information. Status, worked hours, overtime, and the latest correction details come from the server. Employee and attendance date are immutable on correction. Clearing timestamps sends null on updates. There are no fabricated break deductions, notes, correction snapshots, or local check-in records. Working schedules remain deferred, and disabled payroll retains a separate empty attendance input boundary until its complete-period API is connected.

## Verification

- Attendance regression suites: `node scripts/test-attendance.mjs` covers asynchronous store behavior, own-record detail resolution, stale requests, and payroll isolation. `node scripts/test-attendance-api.mjs` exercises the authenticated bridge and backend-shaped records. `node scripts/test-attendance-ui.mjs` checks form actions, validation, and role-gated views; `node scripts/test-attendance-directory.mjs` checks complete-page fetching, calendar date ranges, cancellation, and CSV safety. These use isolated fixtures without changing live attendance.

- New-account flow: `node scripts/test-user-creation.mjs` tests the authenticated bridge with mocked HTTP and the actual dialog with isolated component state. It does not create live accounts or substitute for browser verification.

- Employee regression suites: `node scripts/test-employees.mjs`, `node scripts/test-employees-api.mjs`, `node scripts/test-employee-directory.mjs` and `node scripts/test-employee-store-races.mjs`. These use explicit test fixtures/mocked HTTP, not live accounts. Backend: `node scripts/test-employees.cjs` from `odoo-server`.
- Contract regression suites: `node scripts/test-contracts.mjs` checks backend-shaped validation/mapping, CSV safety, async CRUD references, and absence of runtime mock generation; `node scripts/test-contracts-api.mjs` checks authentication, forwarding, validation, origin protection, error mapping, and cookie privacy with isolated HTTP mocks.
- `pnpm test:auth:live`: checks every auth route on the already-running local frontend, without credentials, mocks, account changes or starting a server. It catches missing routes/HTML 404s that handler-level tests cannot. This is a routing smoke test, not proof of a completed password reset.
- `node scripts/test-auth.mjs`: auth payloads, origin checks, cookie lifetimes, malformed upstream responses, session errors, logout and recovery.
- `node scripts/test-auth-integration.mjs`: protected-layout wiring, real identity, logout/session guard and absence of runtime demo entry points.
- `node scripts/test-no-template-demo.mjs`: empty CRM services, removed fake databases, empty dashboard data and disabled fake email sending.
- Domain regression scripts under `scripts/` exercise pure logic against test-only fixtures and separately check disconnected runtime writes.
- `pnpm exec tsc --noEmit`, targeted ESLint and `pnpm build` check integration.
- Backend `node scripts/test-auth-me.cjs` verifies current-account lookup and authentication middleware without changing a real account.

Historical `verify-*-source.mjs` template snapshots intentionally detect differences where this request removed fake content. Their allowlists were not loosened to hide those changes.

If a newly added auth route returns HTML 404 even though its file exists and the build includes it, restart the existing Next development server to refresh route registration, then run `pnpm test:auth:live`. Do not treat a successful backend-only OTP request or a mocked handler test as a successful browser recovery flow.
