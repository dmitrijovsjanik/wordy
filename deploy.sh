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
