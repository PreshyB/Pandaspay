# Pandas Pay — Mobile

React Native app (Expo + TypeScript), mirroring `../web`'s buyer/seller
flows against the same backend API.

## What's here

Same first slice as web, native:

- **Buyer**: enter a product code → product screen → buy now → order
  status screen with the order and payment-protection badges rendered
  independently (per the state-machine spec) → confirm delivery, open a
  dispute, or (dev-only) simulate the PalmPay webhook.
- **Seller**: list a product and get a shareable code, dashboard to
  accept/decline and ship orders.

`src/api/client.ts`, `src/api/types.ts`, `src/components/StatusBadges.tsx`
and `src/lib/useDevIdentity.ts` are deliberate ports of their `web/`
counterparts — same logic, React Native primitives instead of DOM/CSS.
Keep the two in sync by hand until there's a shared package worth
extracting.

## Running it

```bash
npm install
npx expo start
```

Point the app at your backend: edit `app.json` → `expo.extra.apiBaseUrl`,
or set `EXPO_PUBLIC_API_BASE_URL` at build/start time. **On a physical
device or most simulators, `localhost` means the device itself** — use
your machine's LAN IP (e.g. `http://192.168.1.23:3000`) instead. Make
sure `../backend` is running first (see `../backend/README.md`).

## Temporary: dev identity instead of real auth

Same approach as web (see `web/README.md`), backed by AsyncStorage
instead of localStorage. Replace `useDevIdentity` once real auth exists.

## What's deliberately not built yet

Push notifications, camera/image upload for dispute evidence, native
payment-sheet integration (the web/mobile apps both currently drive
payment confirmation through the dev-only webhook simulator since
PalmPay's real checkout flow isn't confirmed yet), and app-store
packaging/signing.
