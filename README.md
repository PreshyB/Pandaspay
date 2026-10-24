# Pandas Pay

A social-commerce payment-protection and transaction-management platform for
sellers on WhatsApp, Instagram, Facebook, TikTok and Telegram — initial
market Nigeria.

## Repo layout

- `backend/` — NestJS + TypeORM + PostgreSQL API. **Start here** —
  see `backend/README.md`. Implements the dual order/payment-protection
  state machine and the Model B (licensed-partner-custody) fund flow,
  against a mocked PalmPay provider until PalmPay's API docs are confirmed.
- `web/` — React + TypeScript buyer/seller web app. Coming next, built
  against the backend's API once the core order/payment slice is proven.
- `mobile/` — React Native app. After web.

## Build order (why backend-first)

PalmPay's actual marketplace API docs aren't confirmed yet, so the payment
provider is built behind an adapter (`PaymentProviderService`) with a mock
implementation standing in. Everything else — the order lifecycle, the
protection-window/dispute/settlement logic, the disposition lock that
prevents a transaction from being both released and refunded — is real and
fully testable today. Swapping the mock for the real PalmPay integration,
once their docs land, should touch one file.

## Source documents

The product/architecture docs this code is built from live in this repo's
history as reference (converted to markdown for engineering use):

- Pandas Pay — Master Product, Technology, Architecture, Security &
  Development Blueprint
- Pandas Pay — Order Status & Payment Protection State-Machine
  Specification v1.0
- Pandas Pay — Fund Custody & Settlement Model
