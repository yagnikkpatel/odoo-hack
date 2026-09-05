# PeoplePay360 Client

Next.js frontend for the PeoplePay360 HR and payroll platform.

## Local development

1. Copy `.env.example` to `.env.local` and adjust the API URL if needed.
2. Install dependencies with `pnpm install`.
3. Start the client with `pnpm dev`.
4. Open [http://localhost:3000/login](http://localhost:3000/login).

The default backend API URL is `http://localhost:4000/api`. The browser submits credentials to the same-origin `POST /api/auth/login` route. That server-side route calls the backend, stores the returned token in an HTTP-only cookie, and continues successful authentication to `/dashboard`.

## Structure

- `app/` contains routes and route-level metadata.
- `components/ui/` contains reusable design-system primitives extracted from the component warehouse.
- `components/providers/` contains application-wide providers.
- `features/auth/` owns authentication UI, validation, API calls, and token persistence.
- `lib/` contains shared configuration and infrastructure utilities.

The current dashboard route is intentionally a small handoff screen. It provides a stable post-login destination until the HR and payroll application shell is assembled.
