# Stealth Live

Live shopping for regional fashion: creators stream, pin products, shoppers buy without leaving the stream.
The product requirements document (PRD) is shared privately with the team; ask a maintainer for access.

## Layout

| Path | What | Stack |
| --- | --- | --- |
| `apps/web` | Shopper watch-and-buy page, seller/creator dashboards, admin, API | Next.js 16 (App Router), Tailwind |
| `apps/creator` | Creator mobile app (go live, manage lineup) | Expo SDK 58 / React Native |
| `packages/shared` | Wire types, money + payment-split logic, stream cue format, demo fixtures | TypeScript, zod |
| `packages/db` | Postgres schema and migrations | Drizzle ORM |

Conventions: money is integer **paise** (`_paise` columns, `Paise` type); percentages are integer **basis points** (`_bps`).

## Setup

Use **Node 24 LTS** (Expo 58 / React Native 0.88 don't support Node 25).

```sh
npm install
npm run dev:web     # http://localhost:3000, no keys or database needed
npm test            # unit + integration tests (in-memory database)
npm run typecheck   # all workspaces
```

### Database

With no `DATABASE_URL`, the web app starts an **in-memory Postgres** (PGlite), applies the migrations and seeds
demo data (`packages/shared/src/fixtures.ts`). It resets on every restart.

To use a real Postgres instead (needs Docker Desktop running):

```sh
npm run db:up       # Postgres 17 on localhost:5432
npm run db:migrate  # apply packages/db/migrations
npm run db:seed     # demo data
# then set DATABASE_URL=postgres://stealth:stealth@localhost:5432/stealth in apps/web/.env.local
```

After editing `packages/db/src/schema.ts`, run `npm run db:generate` to create a migration.

### Providers

Every third-party service sits behind a small interface in `apps/web/src/server/providers/`, with a fake for
development. All default to stand-ins, so the app runs end to end with no keys.

| Service | Variable | Fake behaviour | Real |
| --- | --- | --- | --- |
| Live video | `VIDEO_PROVIDER` | `local` (default in development): camera goes browser-to-browser over WebRTC, for a few viewers on one machine or Wi-Fi. `fake`: no video. Pins reach viewers over Server-Sent Events in both | `ivs` |
| Payments | `PAYMENT_PROVIDER` | "Pay (test)" sheet; same verify → mark-paid flow | `razorpay` |
| Login OTP | `OTP_PROVIDER` | Code printed in the server terminal, and shown on the login screen in development | not built yet |
| Shipping | `SHIPPING_PROVIDER` | Made-up shipment and tracking number | not built yet |

### Accounts and roles

Sign-in is by phone number and a 6-digit code (`/login`). There's no separate sign-up: a new number gets an
account on first sign-in. Roles come from data: a user is a **creator** if they have a creator profile, a
**seller** if they own a seller account, and an **admin** if `users.is_admin` is set (by hand in the database).

| Demo account | Phone | Can |
| --- | --- | --- |
| Shopper | 98000 00001 | Buy (has a delivery address) |
| Creator | 98000 00002 | Go live and pin on the demo stream |
| Seller | 98000 00003 | Nothing yet (seller dashboard is coming) |
| Admin | 98000 00009 | Act on any stream |

In development the login page has quick-fill buttons for these. To try the whole flow, use two browser
windows (one normal, one private) so each has its own sign-in: sign in as the creator on `/spike/live`,
**Start camera → Go live**, pin a product, and buy it as the shopper on `/spike/watch`.

New accounts can't buy yet, because adding a delivery address comes with the orders work.

## Phase 0 spikes

Three questions to answer with the real providers. They need the keys below.

| # | Question | Pass criteria |
| --- | --- | --- |
| 1 | Can a creator go live from a mid-range Android phone into IVS? | Stream stays up 30 min on 4G without stalling; portrait 720p |
| 2 | Do product pins stay in sync with the video? | Card appears when the creator taps Pin; "pin delay" badge ≤ 5 s on 4G |
| 3 | Does Razorpay Route split a payment correctly? | Test payment shows transfers to seller + creator linked accounts matching the split preview |

### Configure

```sh
cp apps/web/.env.example apps/web/.env.local
```

1. **AWS**: create an IAM user with `ivs:CreateChannel` and `ivs:PutMetadata`, put its keys in `.env.local`, then
   `npm run spike:ivs-channel`, paste the printed `IVS_*` lines into `.env.local`, and set `VIDEO_PROVIDER=ivs`.
2. **Razorpay** (test mode): add key id/secret and set `PAYMENT_PROVIDER=razorpay`. For spike 3, enable Route and
   create two test linked accounts (seller, creator) in the dashboard, and add their `acc_...` ids; the dev database
   attaches them to the demo seller and creator on startup. Without them, checkout works but doesn't split.

### Run

```sh
npm run dev:web     # http://localhost:3000
```

Phone browsers only allow camera access over HTTPS. Either:

- tunnel: `npx cloudflared tunnel --url http://localhost:3000` and open the `https://…trycloudflare.com` URL on the phone, or
- `npm run dev:https -w @stealth/web` and open `https://<your-LAN-IP>:3000` (accept the self-signed cert warning; add the IP to `allowedDevOrigins` in `next.config.ts`).

Then open `/spike/live` on the creator's phone, sign in as the creator, **Start camera → Go live**, and open
`/spike/watch` on another device. Pin products from the phone and buy with Razorpay
[test UPI/cards](https://razorpay.com/docs/payments/payments/test-card-details/).

### Still open after these spikes

- **Native broadcasting in `apps/creator`.** The spikes broadcast from the phone *browser*.
  Evaluate an IVS broadcast module in an Expo dev build (or IVS Real-Time). If neither holds up, LiveKit is the fallback.
- **Chat.** IVS Chat is the plan, so a chat room is needed per stream.
- **Payment confirmation via the `payment.captured` webhook.** The spike only checks the browser-returned signature.
