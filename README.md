# Pokémon MVP

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

---

## ⚡ Prerequisites

- [Node.js](https://nodejs.org/) **v22+** (use [nvm](https://github.com/nvm-sh/nvm) recommended)
- [pnpm](https://pnpm.io/) (project enforces pnpm only)

---

## 🚫 Enforcing `pnpm`

This project **only allows pnpm** to avoid inconsistent lockfiles.
pnpm is a JavaScript package manager (like npm or yarn) for managing dependencies in Node.js projects.
Its main advantage is that it saves disk space and installs faster by sharing packages across projects instead of duplicating them.

- Guard is added via [`only-allow`](https://github.com/pnpm/only-allow).
- If you try `npm install` or `yarn install`, it will fail with a message.

---

## 🚀 Getting Started

To get the project up and running locally, follow these steps:

- Run the setup script. This script installs dependencies, starts a local Postgres database using Docker, and runs database migrations.

`chmod +x scripts/setup.sh`
`./scripts/setup.sh`

- Start the development server.

`pnpm dev`

---

## 🗄️ Using Supabase (Production Database)

By default this project runs Postgres on a hosted Postgres instance on [Supabase](https://supabase.com/).

### 🔑 Setup

1. Create a new Supabase project in the dashboard.
2. Go to **Settings → Database** and copy your connection string.
3. Update your `.env` file:

```env
# For local dev / migrations
DATABASE_URL="postgresql://postgres:<PASSWORD>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

# For production (Vercel / serverless)
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"

```

Use Session Pooler (5432) for local development and running migrations.
Use Transaction Pooler (6543) in production (Vercel) to avoid connection exhaustion.
Do not edit tables directly in the Supabase GUI — always update prisma/schema.prisma and run a migration.

### To create and apply a migration locally:

npx prisma migrate dev --name <migration_name>  
npx prisma migrate deploy

### Seed data is defined in prisma/seed.ts.

pnpm seed

### To reset the db when there's updates to schema

rm -rf prisma/migrations
npx prisma db push --force-reset
npx prisma migrate dev --name init
npx prisma db seed
pnpm prisma generate
