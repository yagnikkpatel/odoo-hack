# PeoplePay360 mobile

Employee attendance workspace using Expo SDK 57, Expo Router and Space Grotesk. Restored square, blue-accent UI with a sticky profile/check-in header, dashboard, attendance history and employee profile.

## Run

```sh
npm ci
# Copy .env.example to .env and set your backend address.
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to the backend URL **including /api**. A physical phone must use a reachable LAN/public address, not localhost. In development only, the app can derive the computer's host from Metro and use port 4000. Production builds require an explicit URL. Never place secrets in Expo public environment variables.

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
