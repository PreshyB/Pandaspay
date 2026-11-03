# BuyBridge — Web

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

Brand violet, type (Fraunces display serif and wordmark, IBM Plex Sans UI,
IBM Plex Mono for order ids, waybill numbers and links) and semantic state
colors are defined in `src/styles/tokens.css`; layout lives in
`src/styles/layout.css`. Dark mode follows `prefers-color-scheme`
automatically.

The mark is the letter B built from a pylon stem and two suspension-cable
arcs (`src/components/BrandMark.tsx`, `public/favicon.svg`). The home page
shows a tied-arch bridge with the buyer's payment held beneath it, and every
order page shows the same idea as a five-stop progress bar
(`src/components/OrderSpan.tsx`). That bar summarises the order; the two
status badges stay the source of truth for the order and payment state
machines.
