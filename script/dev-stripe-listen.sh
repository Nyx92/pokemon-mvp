#!/bin/bash
set -e

# prisma/reset-db.sh's sibling: always run from the project root regardless
# of where this script was invoked from, so `source .env` below finds it.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Authenticates via the app's own STRIPE_SECRET_KEY (--api-key) instead of
# the Stripe CLI's logged-in "default" project. Without this, `stripe listen`
# silently forwards events from whatever Stripe account happens to be your
# CLI's current default project — which may not be this app's account at
# all if you work on other Stripe-connected projects on this machine, and
# webhooks then never arrive here no matter what STRIPE_WEBHOOK_SECRET is
# set to. Pinning the key here means this project never depends on (or
# needs you to re-run) `stripe login` / `--project-name` switching.
#
# Extracted with grep/sed rather than `source .env` — this file isn't
# guaranteed to be valid shell (e.g. it has a stray non-breaking space on
# one line today, which is invisible but breaks `source`), and Next.js's own
# dotenv loader is far more lenient than bash about what counts as a line.
STRIPE_SECRET_KEY="$(grep '^STRIPE_SECRET_KEY=' .env | head -1 | sed -E 's/^STRIPE_SECRET_KEY="?([^"]*)"?$/\1/')"
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "dev-stripe-listen.sh: could not find STRIPE_SECRET_KEY in .env" >&2
  exit 1
fi

exec stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to localhost:3000/api/stripe/webhook
