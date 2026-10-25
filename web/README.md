# Pandas Pay — Web

React + TypeScript (Vite) buyer/seller web app, built against the backend
API in `../backend`.

## What's here

- **Buyer flow**: open a product link (`/p/:slug`) → buy now → order status
  page (`/orders/:id`) showing both the order and payment-protection badges
  independently, per the state-machine spec — confirm delivery, open a
  dispute, or (dev-only) simulate the PalmPay webhook confirming payment.
- **Seller flow**: list a product and get a shareable link
  (`/seller/new-product`), then a dashboard (`/seller`) to accept/decline
  and ship orders.

## Running it

```bash
npm install
npm run dev          # expects the backend running on :3000 (see ../backend/README.md)
```

`vite.config.ts` proxies `/api/*` to the backend so the browser never needs
CORS configured per-environment during dev; set `VITE_API_PROXY_TARGET` to
point at a different backend.

## Temporary: dev identity instead of real auth

The backend has no auth yet (see `../backend/README.md`). `useDevIdentity`
is a deliberate, clearly-marked stand-in: it creates a `User` row via the
API and remembers its id in `localStorage` per browser, per role (buyer /
seller). Nothing else in the app depends on `localStorage` for identity —
replace this hook's internals once real auth exists and the rest of the
app doesn't need to change.

## Design

Carries forward the palette, type system (Fraunces display serif, IBM Plex
Sans UI, IBM Plex Mono for reference/data labels) and semantic state colors
from the earlier wireframe redesign exploration, defined in
`src/styles/tokens.css`. Dark mode follows `prefers-color-scheme`
automatically.
