# BuyBridge — Backend

NestJS + TypeORM + PostgreSQL API implementing the commerce, payment-protection
and settlement-orchestration layer described in the master blueprint, built
directly off the ratified **Order Status & Payment Protection State-Machine
Specification v1.0** and the **Fund Custody & Settlement Model (Model B)**.

## What's here (first working slice)

One real end-to-end path, proving the architecture works before expanding:

```
buyer places an order
  -> payment attempt (mocked PalmPay)
  -> webhook confirms payment -> PROTECTED
  -> seller accepts -> PREPARING
  -> seller ships -> SHIPPED
  -> buyer confirms delivery -> DELIVERED (starts the protection countdown)
  -> protection window elapses, no dispute -> RELEASABLE
  -> settlement job sends payout instruction -> RELEASED
```

Also implemented: payment decline + retry, dispute opening (from PROTECTED
*or* RELEASABLE — the race-sensitive late-dispute path), all three dispute
resolutions (seller-favor, buyer-favor/full-refund, split), pre-acceptance
cancellation + refund, webhook idempotency, and the **disposition lock**
(§5 of the spec) that makes the release/refund race safe.

### Two independent state machines, never collapsed

- `OrderStatus` (`src/common/enums/order-status.enum.ts`) — the
  fulfillment/delivery track.
- `PaymentProtectionStatus` (`src/common/enums/payment-protection-status.enum.ts`)
  — the financial track.

Every module reads from both independently. The enum files carry the exact
transition tables from the spec and are the literal source of truth —
`isValidOrderTransition` / `isValidPaymentTransition` guard every write.

### The disposition lock

`src/payments/disposition-lock.service.ts` implements the compare-and-swap
described in spec §5: `UPDATE payments SET status = ? WHERE id = ? AND
status = ?`, inside the same DB transaction as the outbound
payout/refund-instruction record. Whoever's write affects zero rows has
lost the race and must not send an instruction. See the second test in
`test/order-flow.e2e-spec.ts` for this being exercised directly.

### The payment-provider seam (where PalmPay plugs in)

`src/payment-providers/payment-provider.interface.ts` defines
`PaymentProviderService` — the only thing the rest of the app depends on.
`src/payment-providers/mock-palmpay.provider.ts` is a stand-in that mimics
the *shape* we expect from a Model B MMO/MFB partner (async webhook-confirmed
payment, instruction-sent-then-confirmed payouts/refunds) while PalmPay's
real marketplace API docs are pending.

**Once PalmPay's docs arrive:** implement `PaymentProviderService` in a new
`palmpay.provider.ts`, verify their real webhook signature in
`verifyWebhookSignature`, and change the `useClass` in
`payment-providers.module.ts`. Nothing in orders/payments/disputes/webhooks
should need to change — that's the point of the seam.

## Running it

Needs a real Postgres (entities use `enum`, `jsonb`, `timestamptz` column
types that sqlite can't faithfully emulate):

```bash
npm install
docker compose up -d        # postgres + redis
cp .env.example .env        # DB_SYNCHRONIZE=true is fine for local dev
npm run start:dev
```

Run the tests (the e2e suite needs the same Postgres from docker-compose up):

```bash
npm test            # pure unit tests — state-machine transition tables
npm run test:e2e     # full order -> payment -> protection -> release flow
```

## Simulating PalmPay locally

The mock provider's `initiatePayment` response includes a note telling you
how to simulate the partner confirming payment:

```bash
curl -X POST localhost:3000/webhooks/palmpay \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"evt-1","eventType":"payment.confirmed","providerTransactionRef":"mock_palmpay_txn_..."}'
```

## What's deliberately not built yet

- Real email delivery of sign-in codes. Sign-in is an emailed one-time code
  with signed session tokens and ownership/role checks (see `.env.example`:
  `AUTH_SECRET`, `AUTH_ENFORCED`, `AUTH_DEV_OTP`, `ADMIN_EMAILS`). Until an email
  provider is wired up, codes are returned in the API response in dev and only
  logged in production. Enforcement is always on in production; off by default
  elsewhere so the mobile app (no sign-in yet) keeps working.
- Seller identity/payout verification. Seller activation is an application that
  an admin approves or rejects (audited); no ID documents are collected yet.
- Courier/tracking webhook ingestion (`IN_TRANSIT`, `DELIVERY_FAILED` can be
  driven manually via the order endpoints for now).
- Seller payout-destination storage (the settlement scheduler currently
  passes a placeholder).
- The web frontend and mobile app — next up, against this API.

## Database design notes (per the Fund Custody doc)

No `wallets`, `seller_balance`, `buyer_balance`, or `pandas_pay_escrow`
tables — on purpose. `payments`, `payment_events`, `disputes`,
`settlements`, `provider_webhook_events` and `idempotency_keys` are Pandas
Pay's own operational/audit record, never a representation of funds Pandas
Pay itself holds (Model B: the licensed partner holds the money).
