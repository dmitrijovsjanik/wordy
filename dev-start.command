#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting Wordy dev environment..."

# Pre-cleanup: убить старые tsx/vite/cloudflared если они висят с прошлого
# раза (npm run dev & оставляет дочерние процессы, которые не убиваются
# через kill $! родительского npm). Без этого новый сервер падает с
# EADDRINUSE на 3000/5173.
echo "🧹 Cleaning up any stale processes..."
pkill -f "tsx watch.*src/index.ts" 2>/dev/null
pkill -f "node.*wordy.*vite" 2>/dev/null
pkill -f "cloudflared tunnel.*localhost:5173" 2>/dev/null
pkill -f "npm.*run dev" 2>/dev/null
sleep 1
# Force-kill если порты ещё заняты.
for port in 3000 5173; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null
  fi
done

# Find cloudflared (tunnel отключён по умолчанию; включить через WITH_TUNNEL=1)
CLOUDFLARED=""
if [ "$WITH_TUNNEL" = "1" ]; then
  CLOUDFLARED=$(which cloudflared 2>/dev/null || echo "$HOME/.local/bin/cloudflared")
  if [ ! -x "$CLOUDFLARED" ]; then
    echo "⚠️  cloudflared не найден, tunnel не будет запущен"
    CLOUDFLARED=""
  fi
else
  echo "ℹ️  Tunnel отключён (WITH_TUNNEL=1 чтобы включить)"
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
  $CLOUDFLARED tunnel --protocol http2 --url http://localhost:5173 2>&1 | while read -r line; do
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

# Save PIDs (только для информации; реальная остановка идёт через pkill в trap).
echo "$SERVER_PID" > .dev-pids
echo "$CLIENT_PID" >> .dev-pids
[ -n "$TUNNEL_PID" ] && echo "$TUNNEL_PID" >> .dev-pids

echo ""
echo "Server PID: $SERVER_PID (npm wrapper; tsx — дочерний)"
echo "Client PID: $CLIENT_PID (npm wrapper; vite — дочерний)"
[ -n "$TUNNEL_PID" ] && echo "Tunnel PID: $TUNNEL_PID"
echo ""
echo "Client: http://localhost:5173"
echo "Server: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all..."

# При Ctrl+C — надёжная остановка через те же pkill-паттерны что в dev-stop.
# kill $SERVER_PID убивает только npm-обёртку, tsx/vite остаются зомби.
cleanup() {
  echo ""
  echo "Stopping..."
  pkill -f "tsx watch.*src/index.ts" 2>/dev/null
  pkill -f "node.*wordy.*vite" 2>/dev/null
  pkill -f "cloudflared tunnel.*localhost:5173" 2>/dev/null
  pkill -f "npm.*run dev" 2>/dev/null
  sleep 1
  for port in 3000 5173; do
    pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
      kill -9 $pid 2>/dev/null
    fi
  done
  rm -f .dev-pids
  echo "Stopped."
  exit 0
}

trap cleanup INT TERM

wait
