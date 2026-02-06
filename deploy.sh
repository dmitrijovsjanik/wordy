#!/bin/bash
set -e

TIMESTAMP="$1"
RELEASE_DIR="/var/www/wordy/releases/$TIMESTAMP"
SHARED_DIR="/var/www/wordy/shared"
CURRENT_LINK="/var/www/wordy/current"

echo "==> Deploying release $TIMESTAMP"

# Link shared .env to server
ln -sf "$SHARED_DIR/.env" "$RELEASE_DIR/server/.env"

# Install production dependencies
cd "$RELEASE_DIR"
npm ci

# Update current symlink
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# Load env vars for drizzle-kit
set -a
source "$RELEASE_DIR/server/.env"
set +a

# Run database schema push
cd "$RELEASE_DIR/server"
npx drizzle-kit push --force

# Seed database if empty (one-time import)
WORD_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM words;" 2>/dev/null | tr -d ' ')
if [ "$WORD_COUNT" = "0" ] || [ -z "$WORD_COUNT" ]; then
  SEED_FILE="$RELEASE_DIR/server/src/db/seed/wordy-seed-data.sql.gz"
  if [ -f "$SEED_FILE" ]; then
    echo "==> Database is empty, importing seed data..."
    gunzip -c "$SEED_FILE" | psql "$DATABASE_URL"
    echo "==> Seed import complete!"
  else
    echo "==> Database is empty but no seed file found, skipping"
  fi
else
  echo "==> Database already has $WORD_COUNT words, skipping seed"
fi

# Generate collections if none exist
COLLECTION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM collections WHERE type='system';" 2>/dev/null | tr -d ' ')
if [ "$COLLECTION_COUNT" = "0" ] || [ -z "$COLLECTION_COUNT" ]; then
  echo "==> No system collections found, generating..."
  cd "$RELEASE_DIR/server"
  npx tsx src/db/seed/seed-topics.ts || echo "==> seed-topics failed, continuing"
  npx tsx src/db/seed/generate-collections.ts || echo "==> generate-collections failed, continuing"
  echo "==> Collection generation complete!"
else
  echo "==> Already have $COLLECTION_COUNT system collections, skipping"
fi

# Restart or start PM2 process
cd "$RELEASE_DIR"
if pm2 describe wordy > /dev/null 2>&1; then
  pm2 restart wordy
else
  pm2 start ecosystem.config.cjs --only wordy
fi

pm2 save

# Cleanup old releases (keep last 5)
cd /var/www/wordy/releases
ls -dt */ | tail -n +6 | xargs -r rm -rf

echo "==> Deploy complete!"
