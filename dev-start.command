#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting Wordy dev environment..."

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

# Save PIDs for stop script
echo "$SERVER_PID" > .dev-pids
echo "$CLIENT_PID" >> .dev-pids

echo ""
echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
echo ""
echo "Client: http://localhost:5173"
echo "Server: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both..."

trap 'kill $SERVER_PID $CLIENT_PID 2>/dev/null; rm -f .dev-pids; echo "Stopped."; exit 0' INT TERM

wait
