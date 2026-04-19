# Pokémon MVP

A Pokemon card marketplace built with Next.js 14. Users can list cards for sale, buy cards directly via Stripe Checkout, or place offers backed by a Stripe manual-capture PaymentIntent. Offers have a 24-hour expiry window enforced by a Vercel Cron Job.

---

## Prerequisites

- [Node.js](https://nodejs.org/) **v22+** (use [nvm](https://github.com/nvm-sh/nvm) to manage versions)
- [pnpm](https://pnpm.io/) — this project enforces pnpm only. Running `npm install` or `yarn install` will fail.
- A [Supabase](https://supabase.com/) project (Postgres database + image storage)
- A [Stripe](https://stripe.com/) account (test mode keys are fine for local dev)

---

## Environment variables

Create a `.env` file in the project root. All of these are required:

```env
# Database (see Supabase section below for which URL to use)
DATABASE_URL=""

# Auth
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# Cron job auth — any long random string, must match Vercel env var
CRON_SECRET=""

# Supabase image storage
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_BUCKET="card-images"

# App
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_USD_TO_SGD_RATE="1.29"
```

---

## Getting started

```bash
pnpm install    # installs dependencies and runs prisma generate
pnpm dev        # starts the dev server at http://localhost:3000
```

---

## Database (Supabase + Prisma)

This project uses [Supabase](https://supabase.com/) as the hosted Postgres database and [Prisma](https://www.prisma.io/) as the ORM. Never edit tables directly in the Supabase GUI — always update `prisma/schema.prisma` and run a migration.

### Supabase setup

1. Create a new project at [supabase.com](https://supabase.com/).
2. Go to **Settings → Database** and copy your connection string.
3. Add it to your `.env`:

```env
# Session Pooler — use this for local dev and running migrations (port 5432)
DATABASE_URL="postgresql://postgres:<PASSWORD>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Transaction Pooler — use this in production / Vercel (port 6543)
# Prevents connection exhaustion in a serverless environment
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

### Create and apply a migration

```bash
npx prisma migrate dev --name <migration_name>
npx prisma migrate deploy
```

### Seed the database

Seed data is defined in `prisma/seed.js`.

```bash
pnpm seed
```

### To reset the db when there's updates to schema

rm -rf prisma/migrations
npx prisma db push --force-reset
npx prisma migrate dev --name init
npx prisma db seed
pnpm prisma generate

---

## Stripe setup

### Webhook (local dev)

The Stripe webhook at `POST /api/stripe/webhook` handles `checkout.session.completed` and `checkout.session.expired` events. To test it locally you need the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret it prints and set it as `STRIPE_WEBHOOK_SECRET` in your `.env`.

### Webhook (production)

In your Stripe dashboard, add a webhook endpoint pointing to:

```
https://your-app.vercel.app/api/stripe/webhook
```

Set it to listen for `checkout.session.completed` and `checkout.session.expired`.

---

## Vercel deployment

### Environment variables

Set all variables from the `.env` section above in **Vercel → Project → Settings → Environment Variables**.

Use the **Transaction Pooler** `DATABASE_URL` (port 6543) in production.

### Cron job (offer expiry)

Pending offers expire after 24 hours. The cron job at `GET /api/cron/expire-offers` runs every 5 minutes on Vercel Pro (configured in `vercel.json`).

Two things are required for it to work:

1. Set `CRON_SECRET` to a long random string in Vercel's environment variables. Vercel automatically sends this as a bearer token when invoking the cron — no manual wiring needed.
2. Be on **Vercel Pro** — the Hobby plan only allows once-per-day cron jobs. On Hobby, use a free external service like [cron-job.org](https://cron-job.org) pointing at `https://your-app.vercel.app/api/cron/expire-offers` with header `Authorization: Bearer <CRON_SECRET>`.

---

## Testing

Tests cover all transaction flows: Buy Now checkout, offer placement, offer accept/reject, offer expiry, the cron job, orders, and the Stripe webhook.

**Stripe and Prisma are fully mocked** — no real database or Stripe account is needed to run the tests.

### Commands

```bash
pnpm test              # Run all tests once and exit — same as what CI runs
pnpm test:watch        # Re-run tests on file save (use during development)
pnpm test:coverage     # Run tests + generate a coverage report
```

### Coverage report

```bash
pnpm test:coverage
open coverage/index.html
```

### Where the tests live

```
src/__tests__/
├── lib/
│   ├── money.test.ts              # dollarsToCents / centsToDollars utils
│   └── offerExpiry.test.ts        # expireOffer — PI cancel + DB update logic
└── api/
    ├── checkout/
    │   └── route.test.ts          # POST /api/checkout (Buy Now flow)
    ├── offers/
    │   ├── payment-intent.test.ts # POST /api/offers/payment-intent
    │   ├── route.test.ts          # GET + POST /api/offers
    │   └── patch-offer.test.ts    # PATCH /api/offers/[id] (accept / reject)
    ├── cron/
    │   └── expire-offers.test.ts  # GET /api/cron/expire-offers
    ├── orders/
    │   └── route.test.ts          # GET /api/orders
    └── stripe/
        └── webhook.test.ts        # POST /api/stripe/webhook
```

### How the mocking works

Each test file mocks three things so no real services are hit:

- **Stripe** — `vi.mock("stripe", ...)` replaces the Stripe SDK with a fake. You control what each method returns per test.
- **Prisma** — `vi.mock("@/lib/prisma", ...)` replaces the DB client with fakes. No real database is ever connected to.
- **next-auth** — `vi.mock("next-auth", ...)` controls who is "logged in" for each test.

### CI

Tests run automatically on every push and pull request to `main` via GitHub Actions (`.github/workflows/ci.yml`). A failed test blocks the build — Vercel will not deploy until all tests pass.
