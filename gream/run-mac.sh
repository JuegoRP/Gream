#!/bin/bash
# ═══════════════════════════════════
#  GREAM — Mac dev launcher
# ═══════════════════════════════════
# Usage: ./run-mac.sh
# Or:    sh run-mac.sh

cd "$(dirname "$0")" || exit 1

PORT=8000

echo ""
echo "🌱 Gream — local dev server"
echo "─────────────────────────────"
echo ""

# Find python
if command -v python3 &> /dev/null; then
  PY=python3
elif command -v python &> /dev/null; then
  PY=python
else
  echo "❌ Python not found. Install Python from https://python.org"
  exit 1
fi

# Check port available
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠️  Port $PORT already in use. Trying $((PORT+1))..."
  PORT=$((PORT+1))
fi

echo "Starting server on http://localhost:$PORT"
echo ""
echo "→ Open in browser:    http://localhost:$PORT"
echo "→ Press Ctrl+C to stop"
echo ""

# Open browser automatically
sleep 1 && open "http://localhost:$PORT" &

$PY -m http.server $PORT
