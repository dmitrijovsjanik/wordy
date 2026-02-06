#!/bin/bash

# Переходим в директорию скрипта
cd "$(dirname "$0")"

echo "🔄 Запуск обогащения слов из Yandex Dictionary API..."
echo ""

# Запускаем enrich с флагом --all для обновления всех слов
npm run db:enrich -- --all

echo ""
echo "✅ Процесс завершён. Нажмите любую клавишу для закрытия."
read -n 1
