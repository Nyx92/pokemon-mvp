# Pokémon MVP

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

---

## ⚡ Prerequisites

- [Node.js](https://nodejs.org/) **v22+** (use [nvm](https://github.com/nvm-sh/nvm) recommended)
- [pnpm](https://pnpm.io/) (project enforces pnpm only)
- [Docker](https://www.docker.com/) (for Postgres database)

---

## 🚫 Enforcing `pnpm`

This project **only allows pnpm** to avoid inconsistent lockfiles.

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
