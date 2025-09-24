#!/bin/bash
set -e

echo "📦 Installing dependencies..."
pnpm install

echo "🐘 Starting Postgres..."
docker run --name pokemon-mvp-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pokemon_mvp \
  -p 51214:5432 \
  -d postgres:15 || echo "Postgres already running."

echo "🔧 Running Prisma migrate..."
npx prisma migrate dev --name init_auth

echo "🖥 Launching Prisma Studio..."
npx prisma studio &

echo "✅ Setup complete!"
echo "👉 Prisma Studio is available at http://localhost:5555"
