#!/bin/bash
# Останавливает dev-окружение Wordy надёжно — через pkill по уникальным
# паттернам команд, а не по PID из .dev-pids (npm run dev оставляет
# дочерние tsx/vite, чьи PID'ы в .dev-pids не записаны).
cd "$(dirname "$0")"

stopped_any=0

# tsx watch на server/src/index.ts — единственный кандидат, не задевает другие проекты.
if pkill -f "tsx watch.*src/index.ts" 2>/dev/null; then
  echo "Stopped tsx (server)"
  stopped_any=1
fi

# vite в этом репо — путь содержит "wordy".
if pkill -f "node.*wordy.*vite" 2>/dev/null; then
  echo "Stopped vite (client)"
  stopped_any=1
fi

# cloudflared tunnel на localhost:5173 — наш.
if pkill -f "cloudflared tunnel.*localhost:5173" 2>/dev/null; then
  echo "Stopped cloudflared"
  stopped_any=1
fi

# Сами npm run dev (родители).
if pkill -f "npm.*run dev" 2>/dev/null; then
  echo "Stopped npm wrappers"
  stopped_any=1
fi

# Дать процессам секунду на graceful shutdown, потом проверить порты.
sleep 1

# Если порт 3000 или 5173 ещё кем-то занят — KILL.
for port in 3000 5173; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null && echo "Force-killed process on port $port (PID $pid)"
  fi
done

rm -f .dev-pids

if [ $stopped_any -eq 0 ]; then
  echo "Nothing was running."
else
  echo "Dev environment stopped."
fi
