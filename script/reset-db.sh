#!/bin/bash
set -e

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
echo "✅ Database reset and reseeded."
