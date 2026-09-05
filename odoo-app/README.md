# PeoplePay360 mobile

An understated employee workspace built with Expo SDK 57 and Expo Router.

## Run

```sh
npm install
npx expo start
```

Use an Expo Go version compatible with SDK 57 or an Expo development build. The native tab bar uses `expo-router/unstable-native-tabs` on iOS and Android; web uses a matching bottom tab bar.

## Screens

- Dashboard: top check-in action, attendance stats, week/month chart, monthly summary and recent activity.
- Attendance: sample history, on-time/late filters and current demo session entries.
- Profile: sample employee and work details.
- Check-in: modal preview with demo check-in/check-out confirmation.

The layout follows the supplied wireframe and web analytics, with a quieter visual language inspired by Linear, Emil Kowalski's interaction work, and the supplied mobile references. Rounded neutral surfaces, restrained violet accents and readable type replace the original brutalist scaffold. See [design research and decisions](docs/design-language.md).

Shared controls provide brief touch feedback and system-reduced-motion support. The working-rhythm chart uses Expo Go-compatible `react-native-svg`; tap a plotted period to inspect its value. Native navigation remains native on iOS and Android.

## Data and integration

August 2026 analytics and Alex Morgan's profile are fixtures. The check-in flow stores entries only in React state for the current session; reloading clears them. It does not capture a face, request location, authenticate an employee or submit attendance to the HR backend.

Replace `features/attendance/demo-state.tsx` with the authenticated attendance integration when connecting the backend, camera and proximity checks. The demo is explicitly labelled in the UI.

## Checks

```sh
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform all
```
