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

# Ensure nginx serves admin panel at /admin/
NGINX_CONF=""
for f in /etc/nginx/sites-enabled/wordy /etc/nginx/sites-enabled/wordy-lang.ru; do
  [ -f "$f" ] && NGINX_CONF="$f" && break
done
if [ -n "$NGINX_CONF" ]; then
  echo "==> Patching nginx config: $NGINX_CONF"
  # Use a proper script file to avoid shell variable issues
  PATCH_SCRIPT=$(mktemp /tmp/nginx_patch_XXXX.py)
  cat > "$PATCH_SCRIPT" << 'PYEOF'
import re, sys

conf_path = sys.argv[1]
with open(conf_path, 'r') as f:
    content = f.read()

# Step 1: Remove all existing admin location blocks (line-based)
lines = content.split('\n')
result = []
skip_until_close = False
for line in lines:
    stripped = line.strip()
    if stripped == '# Admin panel':
        continue
    if 'location /admin/' in stripped:
        skip_until_close = True
        continue
    if skip_until_close:
        if stripped == '}':
            skip_until_close = False
        continue
    result.append(line)
content = '\n'.join(result)

# Clean up multiple blank lines
content = re.sub(r'\n{3,}', '\n\n', content)

# Step 2: Insert admin location before "# Static frontend files" or "location / {"
admin_block = '\n'.join([
    '    # Admin panel',
    '    location /admin/ {',
    '        alias /var/www/wordy/current/admin/dist/;',
    '        index index.html;',
    '        try_files $uri $uri/ /admin/index.html;',
    '    }',
    '',
])

if '# Static frontend files' in content:
    content = content.replace('    # Static frontend files', admin_block + '    # Static frontend files')
elif 'location / {' in content:
    content = content.replace('location / {', admin_block + '    location / {', 1)
else:
    print("WARNING: Could not find insertion point", file=sys.stderr)
    sys.exit(0)

with open(conf_path, 'w') as f:
    f.write(content)
print("Nginx config patched successfully")
PYEOF
  python3 "$PATCH_SCRIPT" "$NGINX_CONF"
  rm -f "$PATCH_SCRIPT"

  nginx -t && nginx -s reload
  echo "==> Nginx config updated for /admin/"
else
  echo "==> Nginx config not found, skipping admin location setup"
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
