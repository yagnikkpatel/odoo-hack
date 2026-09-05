# Attendance verification recovery

The Expo app captures a selfie and location. Face detection/matching runs on
**odoo-server**, using a local WASM model; this is not offline phone recognition.
It needs the existing PostgreSQL, Redis and API configuration. Model weights
are bundled in `@vladmandic/face-api`; no separate face vendor API is needed.

## API compatibility

Existing authenticated JSON/no-body `POST /api/attendance/check-in` and
`POST /api/attendance/check-out` still work without verification. Their status
codes remain 201 and 200, with `{ success: true, data: ... }`. Existing attendance
CRUD, pagination and permissions remain in place. Verification fields are additive.

The app uses these authenticated routes:

- `GET /api/attendance/me/verification`: face enrollment and office setup status.
- `POST /api/attendance/me/face`: multipart `selfie` file; returns verification status.
- `POST /api/attendance/check-in` and `/check-out`: multipart `selfie`, `latitude`,
  `longitude`, and optional `accuracy` (meters). JPEG, PNG or WebP; maximum 5 MB.

An attempted proof with missing/malformed fields fails; it never becomes an
unverified legacy check-in. Errors retain `{ success: false, message }`, with an
optional `code` for verification failures. A face mismatch, multiple/no visible
faces, or a location outside the configured fence does not create attendance.

HR sets `workLatitude`, `workLongitude`, and `workRadiusM` through the existing
employee-profile create/update API and its existing permissions. Coordinates
must be supplied together (both null clears them); radius is 10–5000 meters.
Without a configured fence, location is recorded as `not_configured`, not verified.
Face descriptors are internal and are never included in employee API responses.
An uploaded HR profile photo can provide a cached template; self-enrollment wins.

## Migration and deployment

Install dependencies with `npm ci`, apply
`migrations/013_recover_attendance_verification.sql` once in a transaction and
record its filename in the existing `migrations` table, then restart the backend.
Use the normal migration runner only after reviewing **all** pending migrations.
This recovered workspace has an unrelated renamed 010 migration: do not blindly
replay that migration against a database where the former 010 already ran.

013 adds missing columns without removing data. New `NOT VALID` constraints
protect new writes without scanning old tables during deployment; audit old rows
before separately validating those constraints. Existing face templates survive.

Optional environment settings (defaults preserve the earlier MVP behavior):

| Setting | Default | Purpose |
| --- | --- | --- |
| `FACE_MATCH_THRESHOLD` | `0.5` | Maximum embedding distance; lower is stricter. |
| `ATTENDANCE_LOCATION_MAX_ACCURACY_M` | `1000` | Reject less precise GPS fixes when a fence exists. |
| `ATTENDANCE_LOCATION_ACCURACY_ALLOWANCE_M` | `100` | Maximum GPS allowance added to the fence. |
| `ATTENDANCE_STORE_SELFIES` | `true` | Set `false` to skip optional cloud photo storage. |
| `FACE_MODELS_DIR` | Packaged models | Optional local model directory override. |

For tighter GPS requirements, explicitly choose a smaller accuracy limit and
allowance after testing office reception. Do not silently change these defaults
for an existing deployment. Photo storage has a bounded timeout; an upload failure
does not discard an otherwise valid attendance or enrollment.

## Speed, accuracy and limitations

Weights load once per process. Images are orientation-corrected and resized to
640 pixels maximum before inference. One inference runs at a time with eight
queued requests maximum and bounded queue wait; excess requests get a retryable
busy error. Duplicate and geofence checks precede expensive inference. HR-photo
templates are reused; concurrent derivations for the same photo share one job.

Use good lighting, a clear front-facing photo and only one visible face. This is
MVP face matching, **not liveness/anti-spoofing**. Legacy JSON calls deliberately
remain unverified for compatibility; verification is not a universal attendance
security requirement. Evaluate consenting same-person/different-person fixtures
before claiming accuracy or tuning the threshold. No biometric accuracy rate is
claimed from blank-image or mocked tests.

## Checks

```sh
npm run build
node scripts/test-attendance-verification.cjs
node scripts/test-attendance-proof-service.cjs
node scripts/test-verification-persistence.cjs
node scripts/test-employees.cjs
npx tsx src/scripts/test-face-engine.ts
```

The HTTP/service/persistence tests use synthetic fixtures and mocks, not actual
employee records. The engine test runs real blank-image WASM inference, overload
and tensor cleanup checks; see its local fixture option for consenting face tests.
