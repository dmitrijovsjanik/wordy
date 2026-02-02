#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting Wordy dev environment..."

# Find cloudflared
CLOUDFLARED=$(which cloudflared 2>/dev/null || echo "$HOME/.local/bin/cloudflared")
if [ ! -x "$CLOUDFLARED" ]; then
  echo "⚠️  cloudflared не найден, tunnel не будет запущен"
  CLOUDFLARED=""
fi

# Start server
cd server
npm run dev &
SERVER_PID=$!
cd ..

# Start client
cd client
npm run dev &
CLIENT_PID=$!
cd ..

# Start tunnel
TUNNEL_PID=""
if [ -n "$CLOUDFLARED" ]; then
  $CLOUDFLARED tunnel --url http://localhost:5173 2>&1 | while read -r line; do
    echo "$line"
    URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com')
    if [ -n "$URL" ]; then
      echo "$URL" | pbcopy 2>/dev/null
      echo ""
      echo "🔗 Tunnel URL (скопирован в буфер): $URL"
      echo ""
    fi
  done &
  TUNNEL_PID=$!
fi

# Save PIDs for stop script
echo "$SERVER_PID" > .dev-pids
echo "$CLIENT_PID" >> .dev-pids
[ -n "$TUNNEL_PID" ] && echo "$TUNNEL_PID" >> .dev-pids

echo ""
echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
[ -n "$TUNNEL_PID" ] && echo "Tunnel PID: $TUNNEL_PID"
echo ""
echo "Client: http://localhost:5173"
echo "Server: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all..."

trap 'kill $SERVER_PID $CLIENT_PID $TUNNEL_PID 2>/dev/null; rm -f .dev-pids; echo "Stopped."; exit 0' INT TERM

wait
