#!/usr/bin/env bash
# Run VELO over a Cloudflare quick tunnel (Metro on any network).
#
#   pnpm run tunnel        (or)   bash scripts/dev-tunnel.sh
#
# Starts a cloudflared tunnel to the Metro port, then boots Expo pointing its
# manifest/bundle URLs at that public https domain so a device on any network
# (not just your LAN) can load the app. Scan the QR that Expo prints.
#
# NOTE: the map screen uses @maplibre/maplibre-react-native (a native module),
# so it needs a DEV BUILD, not Expo Go. Build the dev client once with
# `npx expo run:ios` / `npx expo run:android` (or EAS), open it, then use this
# tunnel to connect it to Metro. The rest of the app also runs in Expo Go, but
# the map tab will be blank there.
set -euo pipefail

PORT="${PORT:-8081}"
CF_LOG="$(mktemp -t velo-cf.XXXXXX)"

command -v cloudflared >/dev/null 2>&1 || {
  echo "cloudflared not found. Install it:  brew install cloudflared" >&2
  exit 1
}

cleanup() { [[ -n "${CF_PID:-}" ]] && kill "$CF_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "→ Opening Cloudflare tunnel to http://localhost:$PORT ..."
cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate >"$CF_LOG" 2>&1 &
CF_PID=$!

# Wait for cloudflared to print the public URL.
CF_URL=""
for _ in $(seq 1 30); do
  CF_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" | head -n1 || true)"
  [[ -n "$CF_URL" ]] && break
  sleep 1
done

if [[ -z "$CF_URL" ]]; then
  echo "Could not get a tunnel URL. cloudflared output:" >&2
  cat "$CF_LOG" >&2
  exit 1
fi

echo "→ Tunnel ready: $CF_URL"
echo "→ Starting Expo (Expo Go). Scan the QR below."

# Expo derives the exp:// manifest + Metro bundle URLs from this proxy origin,
# so the phone fetches everything through the tunnel instead of your LAN IP.
EXPO_PACKAGER_PROXY_URL="$CF_URL" \
REACT_NATIVE_PACKAGER_HOSTNAME="${CF_URL#https://}" \
  pnpm exec expo start --port "$PORT"
