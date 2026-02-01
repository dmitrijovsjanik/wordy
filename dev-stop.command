#!/bin/bash
cd "$(dirname "$0")"

if [ -f .dev-pids ]; then
  while read -r pid; do
    kill "$pid" 2>/dev/null && echo "Stopped PID $pid"
  done < .dev-pids
  rm -f .dev-pids
  echo "Dev environment stopped."
else
  echo "No .dev-pids file found. Trying to find processes..."
  pkill -f "vite.*client" 2>/dev/null && echo "Stopped Vite"
  pkill -f "tsx.*server" 2>/dev/null && echo "Stopped server"
  echo "Done."
fi
