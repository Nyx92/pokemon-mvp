#!/bin/bash
set -e

# prisma resolves prisma/schema.prisma relative to the CALLER's working
# directory, not this script's location — always run from the project root
# regardless of where this script was invoked from.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "🗑️  Resetting database..."
echo "   This project has no prisma/migrations history (schema is managed via"
echo "   'prisma db push'), so this drops all tables, pushes schema.prisma"
echo "   back in, and reseeds mock data. All existing data will be lost."
echo ""

npx prisma db push --force-reset

echo ""
echo "🌱 Seeding database..."
pnpm run seed

echo ""
echo "🌱 Seeding Riftbound listings..."
echo "   Images already in Supabase Storage are reused, not re-uploaded."
pnpm run seed:riftbound-listings

echo ""
echo "✅ Database reset and reseeded."
