# Stealth Live

Live shopping for regional fashion: creators stream, pin products, shoppers buy without leaving the stream.
Product context is in `prd.pdf`.

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
npm test            # shared package unit tests
npm run typecheck   # all workspaces
```

Database (needs Docker Desktop running):

```sh
npm run db:up       # Postgres 17 on localhost:5432
npm run db:migrate  # apply packages/db/migrations
npm run db:generate # after editing packages/db/src/schema.ts
```

## Phase 0 spikes

Three questions to answer in the first two weeks, before building features.
The spikes run without the database, using the demo catalog in `packages/shared/src/fixtures.ts`.

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
   `npm run spike:ivs-channel` and paste the printed `IVS_*` lines into `.env.local`.
2. Set `SPIKE_CREATOR_TOKEN` to any string of 8+ characters.
3. **Razorpay** (test mode): add key id/secret. For spike 3, enable Route and create two test linked accounts
   (seller, creator) in the dashboard, and add their `acc_...` ids. Without them, checkout works but doesn't split.

### Run

```sh
npm run dev:web     # http://localhost:3000
```

Phone browsers only allow camera access over HTTPS. Either:

- tunnel: `npx cloudflared tunnel --url http://localhost:3000` and open the `https://…trycloudflare.com` URL on the phone, or
- `npm run dev:https -w @stealth/web` and open `https://<your-LAN-IP>:3000` (accept the self-signed cert warning; add the IP to `allowedDevOrigins` in `next.config.ts`).

Then open `/spike/live` on the creator's phone, enter the token, **Start camera → Go live**, and open
`/spike/watch` on another device. Pin products from the phone and buy with Razorpay
[test UPI/cards](https://razorpay.com/docs/payments/payments/test-card-details/).

### Still open after these spikes

- **Native broadcasting in `apps/creator`.** The spikes broadcast from the phone *browser*.
  Evaluate an IVS broadcast module in an Expo dev build (or IVS Real-Time). If neither holds up, LiveKit is the fallback.
- **Chat.** IVS Chat is the plan, so a chat room is needed per stream.
- **Payment confirmation via the `payment.captured` webhook.** The spike only checks the browser-returned signature.
