# PeoplePay360 Client

Next.js frontend for the PeoplePay360 HR and payroll platform.

The interface defaults globally to NexaCRM's blue Modern Minimal preset in light mode, including native browser controls. Login uses its original blurred dashboard background and pointer-following spotlight (disabled for reduced motion).

## Temporary dashboard preview

Preview mode is enabled in `features/auth/auth-config.ts`. Clicking **Sign in** opens `/dashboards/analytics` without credentials or a backend request. Opening or refreshing the dashboard directly also works using the preview identity and mock data.

Set `authConfig.previewEnabled` to `false` when backend authentication is ready. This restores native form validation, the login API request, and server-side session verification. Disable preview mode before connecting protected data or releasing authenticated functionality.

## Local development

1. Copy `.env.example` to `.env.local` and adjust the API URL if needed.
2. Install dependencies with `pnpm install`.
3. Start the client with `pnpm dev`.
4. Open [http://localhost:3000/login](http://localhost:3000/login).

The default backend API URL is `http://localhost:4000/api`. The browser submits credentials to the same-origin `POST /api/auth/login` route. That server-side route calls the backend, stores the returned token in an HTTP-only cookie, and continues successful authentication to `/dashboards/analytics`.

## Structure

- `app/` contains routes and route-level metadata.
- `components/layout/` contains the collapsible authenticated application shell.
- `components/ui/` contains reusable design-system primitives extracted from the component warehouse.
- `config/` contains typed navigation and application configuration.
- `features/auth/` owns authentication UI, API calls, and session handling.
- `features/nexacrm/views/dashboards/analytics/` contains the original NexaCRM analytics components and demo data, copied without UI changes. The route renders this view directly; entrance motion lives in its route CSS module. Shared template primitives stay under `features/nexacrm/components/ui/`.
- `features/employees/` owns `/employees` and `/employees/[id]`: an HR-specific adaptation of the NexaCRM directory, grid, preview panel and full profile. It reuses the template primitives and styles, with separate employee types, native state, CSV mapping and change history.
- `features/contracts/` owns `/contracts` and `/contracts/[id]`, reusing the Employees/NexaCRM table, preview sheet, details rail, forms and menu primitives. Its native state is separate from employee and CRM data.
- `features/nexacrm/views/apps/people/` preserves the original CRM People implementation for reuse and source verification; the Employees routes no longer render its CRM fields or tabs.
- `features/nexacrm/views/apps/opportunities/` supplies the separate `/kanban` page. It opens in the source Kanban view, with draggable cards/columns, stage editing, record panels and the original table/calendar switcher. `/opportunities` links redirect here to preserve template cross-links.
- `features/nexacrm/adapters/` uses React's native `useSyncExternalStore` and browser History APIs instead of Zustand/nuqs. Import validation is plain TypeScript, not Zod. Demo records remain in memory and reset on reload; the demo role is not backend authorization.
- `features/nexacrm/providers/demo-records-provider.tsx` seeds the CRM and employee stores in the app layout. Employee edits survive route navigation but are isolated from CRM People and Kanban; a full reload resets the preview data.
- `lib/` contains shared configuration and infrastructure utilities.

`/dashboard` remains as a compatibility route and redirects to the original NexaCRM analytics dashboard.

## Sidebar scope

The sidebar follows the PeoplePay360 problem statement with six primary modules:

| Main module | Contents |
| --- | --- |
| Employees | Employee directory and record hub; related-record actions belong on the employee form |
| Contracts | Employment terms, active contracts and contract history |
| Attendance | Attendance records and working schedules |
| Time off | Requests, allocations/balances and time off types |
| Payroll | Payruns, payslips, salary structures and salary rules |
| Reports | Existing dashboard preview and future HR/payroll reports |

Settings (users/roles and system settings) and the existing CRM Kanban preview are secondary items at the bottom. Kanban is retained as a reusable preview, not presented as the final employee Kanban. Departments and employee types remain record fields/report filters instead of separate top-level navigation. Wizard steps, approvals, payroll processing, PDFs and email remain actions within their modules, not extra menu entries.

Only one submenu opens at a time; icon-only mode exposes the same children through a keyboard-accessible popup. Every role sees all modules for now. Unbuilt destinations are labelled **Soon** and are not links; activate their `status` in `config/app-navigation.ts` when their pages exist. The sidebar does not implement backend permissions or add HR/payroll business screens. Header titles and active-route matching share the navigation configuration.

Run `node scripts/test-navigation.mjs` to verify required menu coverage, working destinations and nested/alias route matching.

## Source verification

Run `node scripts/verify-analytics-source.mjs`, `node scripts/verify-people-source.mjs`, and `node scripts/verify-kanban-source.mjs` to compare the preserved template UI against the local warehouse. Pass a template directory as the first argument if its location changes. The checks allow documented import/routing/type adaptations, not redesigned markup or styles. The People check covers the preserved CRM source, not the intentionally cleaned HR adaptation. `node scripts/test-native-adapters.mjs` tests the native state/CSV adapters; `node scripts/test-employees.mjs` covers employee seed isolation, CRUD/history, manager references, CSV validation and the reduced UI scope.

## Employees preview

The default table contains Name, Work email, Department, Job position, Manager and Status; Phone is an optional column. Table/grid views, search, filtering, sorting, column controls, pagination, row selection and CSV import/export remain. The original NexaCRM four-card KPI layout is restored above both views, showing Total employees, Departments, With manager and Without manager from the employee store (directory-wide, independent of table filters). Unset departments are excluded; missing managers count as Without manager. The calendar view, fill-percentage footer, company/account-owner/social fields, favorites and CRM communication/task tabs are removed from Employees. Profiles contain employee details and an employee-only timeline, with quiet audit metadata in a collapsible section. Creating an employee requires submitting the form; cancelling never creates a blank record. Deletion requires confirmation.

Identity/contact data still comes from the template preview. Department, manager, status and employment type are deliberately unset until edited; CRM company and account owner are not treated as HR fields. Contracts now shows the actual in-memory count and opens `/contracts?employee=<id>`. Working schedules and related Attendance, Time off and Allocations remain marked **Soon**. Backend persistence, contract/payroll dependency checks and role-based access are not implemented by this UI cleanup.

## Contracts preview

Based on A2 and B2 of the source PDF, Contracts provides a clean list with dates, wages and status, search/filter/sort/column controls, pagination, CSV export, a slide-out Details/History panel and a full details page. New/Edit uses a single validated form for atomic employment-term changes. The employee link opens their profile; contract history lists all their agreements. No KPI cards or CRM-only fields were added.

Seven explicitly labelled illustrative contracts show active, expired, scheduled and draft cases, including a prior agreement for the same employee. Demo wages default to INR/month; the form also supports other listed currencies and wage periods. These are sample terms, not employee salary facts or inferred CRM data. State survives route navigation and resets on full reload. Employee master fields are not overwritten by contract edits.

Dates are inclusive. Active-state contracts cannot overlap for the same employee, including open-ended and scheduled agreements. Display status is derived from the record's state and dates; expired agreements remain available for historical periods. `contractForPeriod` selects by the requested dates, ignores drafts/cancelled records, and reports periods spanning multiple agreements rather than choosing one arbitrarily. This is a tested integration helper, not a connected payroll engine or proration implementation.

Salary structure and working schedule are name-only preview fields until their setup modules can supply real IDs. New records are only created on submit; Cancel makes no changes. Deletion requires confirmation and currently affects only this in-memory preview. Real persistence, employee referential integrity, payroll-dependent edit/delete restrictions, server-side overlap constraints and role enforcement must be added at the backend boundary. All roles still share the preview sidebar, as requested for the UI phase.

Run `node scripts/test-contracts.mjs` for date and overlap boundaries, historical lookup, CRUD isolation, CSV safety and UI integration checks.

The separate Kanban remains a CRM template preview: linked Companies and Sales routes have not been added, and template-only payment/email actions are not connected to services.
