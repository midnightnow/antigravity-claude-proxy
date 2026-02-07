#!/bin/bash

# Antigravity Claude Proxy + Bullrider Startup Script

echo "🐂 Starting Antigravity Stack..."

# 1. Kill existing processes
echo "🧹 Cleaning up old processes..."
pkill -f "bullrider-darwin-arm64"
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:9000 | xargs kill -9 2>/dev/null

# 2. Start Bullrider (Background)
if [ ! -f "bullrider/bullrider-darwin-arm64" ]; then
    echo "🔨 Building Bullrider..."
    cd bullrider && go build -o bullrider-darwin-arm64 main.go && cd ..
fi

echo "🚀 Launching Bullrider (Port 9000)..."
cd bullrider
./bullrider-darwin-arm64 >> /tmp/bullrider.log 2>&1 &
BULLRIDER_PID=$!
cd ..

# Wait for Bullrider to be ready
sleep 1
if ! kill -0 $BULLRIDER_PID >/dev/null 2>&1; then
    echo "❌ Bullrider failed to start. Check /tmp/bullrider.log"
    exit 1
fi
echo "✅ Bullrider active (PID $BULLRIDER_PID)"

# 3. Start Proxy (Foreground or Background)
echo "🧠 Launching Proxy Brain (Port 8080)..."
npm start

# Trap cleanup
trap "kill $BULLRIDER_PID" EXIT
