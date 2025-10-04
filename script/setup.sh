#!/bin/bash
set -e

echo "📦 Installing dependencies..."
pnpm install

echo "🔧 Running Prisma migrate against Supabase..."
npx prisma migrate dev --name init_auth

echo "🌱 Seeding database..."
pnpm seed

echo "✅ Setup complete!"
echo "👉 You can now view and edit data via the Supabase Dashboard (Table Editor)."
