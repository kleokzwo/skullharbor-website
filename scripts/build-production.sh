#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="/var/www/skullharbor.org"

echo "[SkullHarbor] Building production runtime..."

mkdir -p "$TARGET"
mkdir -p "$TARGET/private/products"
mkdir -p "$TARGET/private/state"

# Website
rm -rf "$TARGET/public"
cp -a "$ROOT/public" "$TARGET/public"

# Backend
rm -rf "$TARGET/server"
cp -a "$ROOT/server" "$TARGET/server"

# Runtime files
cp "$ROOT/package.json" "$TARGET/package.json"
cp "$ROOT/package-lock.json" "$TARGET/package-lock.json"
cp "$ROOT/ecosystem.config.cjs" "$TARGET/ecosystem.config.cjs"

echo
echo "[SkullHarbor] Production runtime built:"
echo "  $TARGET"
echo
echo "[SkullHarbor] Preserved:"
echo "  .env"
echo "  private/products/"
echo "  private/state/"