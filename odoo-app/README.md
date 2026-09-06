# PeoplePay360 mobile

Employee attendance workspace using Expo SDK 57, Expo Router and Space Grotesk. Restored square, blue-accent UI with a sticky profile/check-in header, dashboard, attendance history and employee profile.

## Run

```sh
npm ci
npm start
```

`npm start` detects your computer's LAN address and the backend port, checks `/api/health`, starts the sibling backend if it is not running, and launches Expo with the right API address. Install backend dependencies and configure its database/Redis once first. Keep your phone on the same network. Existing backend processes are reused and never stopped; a backend started by this utility stops when you exit Expo.

Use `npm run android`, `npm run ios`, or `npm run web` for the same automatic setup. For a custom backend use `npm run connect -- dev --url https://your-backend-domain`. To test LAN connectivity without starting anything, run `npm run connect -- dev --check-only`. Set `APP_BACKEND_PORT` only if you need to override the port from `../odoo-server/.env` (default 4000). VPN/firewall or Wi-Fi isolation can still prevent phone connectivity.

## Production connection (configure once)

```sh
npm run connect -- production --url https://your-backend-domain
npm run backend:check
```

The utility adds `/api` if needed, checks the health endpoint, and saves **only the public URL** in `backend.config.json`. Commit that file with the app before a cloud build. `app.config.js` embeds the saved address into compiled Android/iOS/web releases; installed apps do not need Metro or a local `.env` file. A release/export fails early if the backend URL is missing, HTTP-only, or private/localhost.

Deploy the backend to a stable public HTTPS hostname first. The utility does not deploy servers, configure domains/TLS or bypass network restrictions. Changing server IPs behind the same hostname needs no app change; changing the hostname requires a new build or a separately configured Expo Update. Already-installed builds cannot run this Node setup script.

Production URL precedence: `APP_PRODUCTION_API_URL` (explicit CI override), saved `backend.config.json`, then legacy `EXPO_PUBLIC_API_URL`. Development uses the URL provided by the utility; direct `npx expo start` still supports the legacy environment variable. Both backend origins and base paths ending in `/api` are accepted. Do not use the website URL unless it actually hosts the same API. Never place secrets in these public settings.

Use Expo Go compatible with SDK 57, or a development build. Web camera/location require a secure context (HTTPS or localhost).

## What is included

- Employee login through `POST /api/auth/login`.
- Native session persistence with SecureStore, refresh-token rotation on expired access, and sign-out. Web preview sessions stay in memory and require login after a reload.
- Real profile data through `GET /api/employees/:userId`.
- Own attendance and dashboard statistics through `GET /api/attendance/me` and `/me/today`, with pull-to-refresh and foreground refresh.
- Native tabs on iOS; a compact, in-flow Expo Router bar on Android/web. Pages end above the bar with 20 px of scrollable bottom spacing.
- Bottom-sheet selfie capture, enrolment and check-in/check-out screens, camera permissions, resized JPEG uploads and one foreground GPS fix.
- Date/time display in Asia/Kolkata. Dashboard workday targets assume Monday–Friday and eight hours; they do not model holidays or individual schedules.

## Backend prerequisite for face check-in

The compatible face-verification API is restored in `../odoo-server`. Install its dependencies, apply its attendance recovery migration, and deploy/restart that backend; updating the app alone does not update a remote server. See [backend setup and verification details](../odoo-server/docs/attendance-verification.md). The app shows an explicit setup error if those endpoints are missing; it never silently falls back to unverified attendance.

Required contract:

- `GET /api/attendance/me/verification` → `{ success: true, data: { face: { enrolled, enrolledAt?, source? }, office: { configured, name, radiusM } } }`
- `POST /api/attendance/me/face` → multipart `selfie`; creates the employee's template.
- `POST /api/attendance/check-in` and `/check-out` → multipart `selfie`, `latitude`, `longitude`, optional `accuracy`; return the saved attendance record.
- Failed verification returns a non-2xx response with `message` and optional `code` such as `NO_FACE`, `MULTIPLE_FACES`, `FACE_MISMATCH`, `FACE_NOT_ENROLLED`, `OUTSIDE_GEOFENCE` or `LOCATION_IMPRECISE`.

The phone captures a photo; identity and location checks belong to the server. There is no on-device face recognition or liveness detection. Photos/GPS are uploaded only after confirmation. HR must configure the office geofence on the compatible backend. Photo previews remain in the device's application cache.

Uploads use an `expo-file-system` File on native platforms and a Blob on web, not legacy React Native `{ uri }` multipart parts. The multipart Content-Type is left to fetch so the boundary is generated correctly.

## Verification

```sh
npm run typecheck
npm run lint
node scripts/test-attendance-stats.cjs
npx expo export --platform all
```

Build checks do not replace physical-device testing of camera permissions, GPS accuracy and the compatible server's face-verification flow.
