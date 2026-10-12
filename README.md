# CoffeeShop — Coffee House Management System

A management system for a coffee house with **SMS payment verification** for
Ethiopian mobile-money / bank providers (Telebirr, CBE Birr, Amole, Awash).

- **Mobile app (Expo)** — Owner role (SMS capture + all management) and Employee
  role (POS, live order board, payment verification). This is the primary app.
- **Web app (Next.js)** — read-only **public menu** reached by QR code.
- **API (Express + Prisma + Socket.IO)** — all business logic and the payment
  verification engine.

Payments are verified by parsing the payment SMS **and/or the payment
notifications** that arrive on the **owner's phone**; parsed payments become
available to employees in real time.

## Architecture

```
Owner phone (Android/Expo)                 API (Express + Prisma + Socket.IO)        Employee phone (Expo)
──────────────────────────                 ───────────────────────────────────        ─────────────────────
payment SMS  ─┐                            /api/payments/ingest (device key)          live payment feed (Socket.IO)
payment notif ─┤ → match owner template ▶  server re-parses raw text (never trusts   attach payment to order
               │   extract amount/txnId     client), dedupe, auto-match to order       manual verify by txnId
               └─ POST to ingest            mark order PAID, deduct recipe stock
                                           emit realtime event ─────────────────────▶
```

- **Two capture sources on the owner phone:** incoming SMS (foreground poll) and
  **bank/mobile-money notifications** via a native Android
  `NotificationListenerService` (event-driven). Both feed the same template
  engine and ingest endpoint (`source: SMS | NOTIFICATION`).

- **Templates are owner-authored in the app** (token templates auto-compiled to
  regex), versioned, editable, with an unmatched-SMS inbox for when a provider
  changes its format. Starter presets for the four providers ship in the seed.

## Monorepo layout

```
coffeeShop/
  apps/
    api/       Express + TypeScript + Prisma + Socket.IO
    mobile/    Expo app — Owner & Employee roles
    web/       Next.js — public menu display only
  packages/
    shared/    Zod schemas, types, SMS template compiler + field detector
  docker-compose.yml   Postgres + Redis
```

## Prerequisites

- Node >= 20, pnpm 10
- PostgreSQL 16 and Redis 7 (local installs or `docker compose up -d`)

## Setup

```bash
cp .env.example .env          # adjust DATABASE_URL / secrets
pnpm install

# create the database (example with a local Postgres superuser)
#   CREATE ROLE coffeeshop LOGIN PASSWORD 'coffeeshop' CREATEDB;
#   CREATE DATABASE coffeeshop OWNER coffeeshop;

pnpm --filter @coffeeshop/shared build
pnpm db:migrate               # prisma migrate dev
pnpm db:seed                  # shop + owner + 4 provider presets + demo menu
pnpm --filter @coffeeshop/api dev        # API on :4000
pnpm --filter @coffeeshop/web dev        # public menu on :3000
pnpm --filter @coffeeshop/mobile start   # Expo (Android dev client)
```

Seeded owner login: `owner@coffeeshop.local` / password `owner12345` / PIN `1234`.

## Useful scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @coffeeshop/api dev` | Run the API |
| `pnpm --filter @coffeeshop/web dev` | Run the public menu |
| `pnpm --filter @coffeeshop/mobile start` | Run the Expo app |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Prisma migrate / seed / studio |
| `pnpm --filter @coffeeshop/shared test` | SMS/notification parser tests (36) |
| `pnpm --filter @coffeeshop/api test` | API integration tests (68) |
| `pnpm test` | Run everything (turbo) |

## Testing

Two layers, both runnable from the root with `pnpm test`:

- **`packages/shared`** — 36 unit tests for the token-template compiler,
  extractor and field detector, including fixtures for Telebirr, CBE Birr,
  Amole and Awash, plus edge cases (comma amounts, optional blocks, multi-line
  bodies, best-effort matching, overlap handling).
- **`apps/api`** — 68 integration tests that boot the Express app in-process on
  an ephemeral port and exercise auth, staff/roles, shifts, catalog, inventory,
  orders/lifecycle, templates, devices, the payments engine (ingest, server-side
  re-validation, exact/heuristic/ambiguous matching, dedupe, unmatched inbox,
  verify/match/unmatch, `NOTIFICATION` source), reports and the public menu.

The API suite runs against a dedicated database and resets it automatically:

```bash
# one-time: create the test database
psql -d postgres -c "CREATE DATABASE coffeeshop_test OWNER coffeeshop"

pnpm test            # turbo: builds shared, then runs both suites
# or
pnpm --filter @coffeeshop/api test   # pretest resets coffeeshop_test + seeds
```

Test config lives in `apps/api/.env.test`. Redis must be reachable (used for
refresh-token rotation).

## Feature status

- **P0 Scaffold** — monorepo, workspaces, full Prisma domain schema, migrations.
- **P1 Core API** — staff auth (password/PIN) with refresh rotation, roles &
  guards, staff CRUD, shifts (open/close + cash reconciliation), shop settings,
  audit log, health, Socket.IO realtime, device-key middleware.
- **P2 Catalog + Inventory** — categories & products (variants, recipes/BoM),
  inventory items with low-stock detection, stock movements
  (IN/OUT/ADJUST/WASTE/SALE), recipe consumption on paid orders.
- **P3 Orders** — order creation with totals/tax, per-shop order numbers,
  lifecycle transitions (guarded), order board, void, cash payment, recipe
  deduction on PAID, realtime events.
- **P4 Payments** — SMS template CRUD/test/from-SMS/activate/revisions; device
  registration + config; payment ingest with **server-side re-parsing**, dedupe,
  exact + heuristic order matching, unmatched-SMS inbox, manual verify,
  match/unmatch.
- **P5 Mobile** — Owner: device pairing + SMS capture + Template Studio +
  unmatched inbox + menu/inventory/staff/reports. Employee: POS order entry,
  live order board, payments feed + verify/match.
- **Native notification listener** — an Expo local module
  (`apps/mobile/modules/notification-listener`) with an Android
  `NotificationListenerService` + Kotlin↔JS bridge, wired into the owner app
  alongside SMS capture (`source: NOTIFICATION`).
- **P6 Public menu** — `GET /api/public/menu/:slug` + Next.js `/m/[slug]` page.
- **P7 Reports** — sales summary, daily series, top products, payments
  reconciliation, inventory valuation/low-stock.

### API surface

`/health` · `/api/auth` · `/api/staff` · `/api/shifts` · `/api/settings` ·
`/api/catalog` · `/api/inventory` · `/api/orders` · `/api/templates` ·
`/api/devices` · `/api/payments` · `/api/reports` · `/api/public` ·
Socket.IO rooms (`order:created`, `order:updated`, `payment:received`,
`sms:unmatched`).

## Mobile notes / risks

- **SMS capture** uses `react-native-get-sms-android` and needs a **custom
  Android dev client** (not Expo Go). It polls the inbox in the foreground.
- **Notification capture** is a local Expo module
  (`modules/notification-listener`) that registers an Android
  `NotificationListenerService`. After the app is installed, grant **Notification
  access** in system settings (the owner app opens the settings screen from the
  "Grant notification access" button). It is event-driven and buffers
  notifications posted before JS attaches.
- Background capture while the app is fully closed requires a native Android
  `BroadcastReceiver` for SMS (not yet implemented); the notification listener
  runs whenever the service is bound by the system.
- Google Play restricts SMS/notification-listener apps; the owner app may need
  sideload/enterprise distribution.
- Same-amount collisions are auto-matched only when unambiguous; otherwise the
  cashier confirms the match.
