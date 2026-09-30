#!/usr/bin/env bash
# Zero-downtime VPS release, run by GitHub Actions over SSH (forced command) or by hand:
#   civicpulse-deploy [<40-char commit sha>]     (default: latest main)
#
# Layout under $APP:
#   shared/.env.local   secrets (never in git)
#   releases/<sha>/     one built checkout per deploy (last $KEEP kept)
#   current -> releases/<sha>   what pm2 serves
# A new release is built next to the live one; the symlink only flips after a successful build,
# and flips back if the new version fails its health check.
set -euo pipefail

APP=/var/www/civicpulse
REPO=https://github.com/Piyush0000/civicPulse.git
BRANCH=main
PORT=3100
KEEP=3
NAME=civicpulse

exec 9>/var/lock/civicpulse-deploy.lock
flock 9 # one deploy at a time

# Only a full commit sha is accepted from the SSH client; anything else means "latest main".
REQ="${1:-${SSH_ORIGINAL_COMMAND:-}}"
if [[ "$REQ" =~ ^[0-9a-f]{40}$ ]]; then SHA="$REQ"; else SHA=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1); fi
[ -n "$SHA" ] || { echo "could not resolve $BRANCH"; exit 1; }

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)
if [ "$(basename "${PREV:-none}")" = "$SHA" ]; then echo "already live: $SHA"; exit 0; fi

REL="$APP/releases/$SHA"
echo "==> building $SHA"
rm -rf "$REL"
mkdir -p "$REL"
cd "$REL"
git init -q
git remote add origin "$REPO"
git fetch -q --depth 1 origin "$SHA"
git checkout -q FETCH_HEAD
ln -sfn "$APP/shared/.env.local" .env.local
npm ci --no-audit --no-fund --loglevel=error
NEXT_TELEMETRY_DISABLED=1 npm run build

switch_to() {
  ln -sfn "$1" "$APP/current.tmp" && mv -Tf "$APP/current.tmp" "$APP/current"
  if pm2 describe "$NAME" >/dev/null 2>&1; then pm2 restart "$NAME" --update-env >/dev/null
  else pm2 start npm --name "$NAME" --cwd "$APP/current" -- start -- -p "$PORT" -H 127.0.0.1 >/dev/null; fi
  pm2 save >/dev/null
}

healthy() {
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/v1/health" && return 0
    sleep 2
  done
  return 1
}

echo "==> switching to $SHA"
switch_to "$REL"
if ! healthy; then
  echo "!! $SHA failed its health check"
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    echo "==> rolling back to $(basename "$PREV")"
    switch_to "$PREV"
    healthy || echo "!! rollback is unhealthy too"
  fi
  exit 1
fi

# Housekeeping: keep the newest $KEEP releases (never the live one).
LIVE=$(readlink -f "$APP/current")
ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r d; do
  [ "$(readlink -f "$d")" = "$LIVE" ] || rm -rf "$d"
done
echo "==> live: $SHA"
