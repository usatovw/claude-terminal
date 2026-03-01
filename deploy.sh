#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPSTREAM_CONF="/etc/nginx/claude-terminal-upstream.conf"
HEALTH_TIMEOUT=60
DRAIN_WAIT=5

cd "$PROJECT_DIR"

log() { echo "[deploy] $(date '+%H:%M:%S') $*"; }
die() { log "FATAL: $*"; exit 1; }

# ── Prevent concurrent deploys ──
exec 200>"${PROJECT_DIR}/.deploy.lock"
flock -n 200 || die "Deploy already in progress"

# ── Determine current active instance ──
if [ ! -f "$UPSTREAM_CONF" ]; then
  echo "server 127.0.0.1:3000;" > "$UPSTREAM_CONF"
fi

current_port=$(grep -oP ':\K\d+' "$UPSTREAM_CONF" | head -1)
if [ "$current_port" = "3000" ]; then
  old_name="claude-terminal-blue"
  new_name="claude-terminal-green"
  new_port=3001
else
  old_name="claude-terminal-green"
  new_name="claude-terminal-blue"
  new_port=3000
fi

log "Current: $old_name (port $current_port)"
log "Deploying to: $new_name (port $new_port)"

# ── Step 1: Install deps + Build ──
log "Installing dependencies..."
npm ci --include=dev --prefer-offline || die "npm ci failed"

log "Building Next.js..."
build_start=$(date +%s)
# Backup previous build for rollback
[ -d .next ] && cp -r .next .next.backup 2>/dev/null || true
npm run build || {
  log "Build failed, restoring backup..."
  [ -d .next.backup ] && rm -rf .next && mv .next.backup .next
  die "Build failed"
}
rm -rf .next.backup 2>/dev/null || true
build_end=$(date +%s)
log "Build completed in $((build_end - build_start))s"
log "Bundle size: $(du -sh .next/static/chunks/ 2>/dev/null | cut -f1)"

# ── Step 2: Start new instance ──
log "Starting $new_name on port $new_port..."

# Delete old PM2 process if exists, then start fresh
pm2 delete "$new_name" 2>/dev/null || true
pm2 start ecosystem.config.js --only "$new_name" 2>/dev/null || true

# ── Step 3: Health check with timeout ──
log "Waiting for health check on port $new_port..."
elapsed=0
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
  if curl -sf "http://127.0.0.1:$new_port/api/health" > /dev/null 2>&1; then
    log "Health check passed after ${elapsed}s"
    break
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
  log "Health check failed after ${HEALTH_TIMEOUT}s — rolling back"
  pm2 delete "$new_name" 2>/dev/null || true
  if curl -sf "http://127.0.0.1:$current_port/api/health" > /dev/null 2>&1; then
    log "Old instance ($old_name) is healthy — rollback OK"
  else
    log "WARNING: Old instance ($old_name) is NOT responding!"
  fi
  die "Deploy aborted — old instance still serving"
fi

# ── Step 4: Switch nginx upstream ──
log "Switching nginx to port $new_port..."
echo "server 127.0.0.1:$new_port;" > "$UPSTREAM_CONF"

if ! nginx -t 2>/dev/null; then
  # Rollback nginx config
  echo "server 127.0.0.1:$current_port;" > "$UPSTREAM_CONF"
  pm2 delete "$new_name" 2>/dev/null || true
  if curl -sf "http://127.0.0.1:$current_port/api/health" > /dev/null 2>&1; then
    log "Old instance ($old_name) is healthy — rollback OK"
  else
    log "WARNING: Old instance ($old_name) is NOT responding!"
  fi
  die "nginx config test failed — rolled back"
fi

nginx -s reload

# ── Step 5: Drain old instance ──
log "Draining old instance (${DRAIN_WAIT}s)..."
sleep "$DRAIN_WAIT"

# ── Step 6: Stop old instance ──
log "Stopping $old_name..."
pm2 stop "$old_name" 2>/dev/null || true
# Clean up after drain — delete the stopped process
pm2 delete "$old_name" 2>/dev/null || true

# ── Step 7: Verify old instance is down ──
if curl -sf "http://127.0.0.1:$current_port/api/health" > /dev/null 2>&1; then
  log "WARNING: Old instance still responding on port $current_port"
fi

# ── Step 8: Save PM2 state ──
pm2 save 2>/dev/null || true

deploy_end=$(date +%s)
log "Deploy complete in $((deploy_end - build_start))s! Active: $new_name on port $new_port"
