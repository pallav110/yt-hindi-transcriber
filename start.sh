#!/bin/bash

echo "🔍 Checking Vosk model..."

if [ ! -d "transcriber/vosk-model/vosk-model-hi-0.22" ]; then
  echo "🔽 Downloading Hindi Vosk model..."
  ./download_model.sh
else
  echo "✅ Vosk model already exists."
fi

# Run Flask app in background
echo "🚀 Starting Flask server..."
python3 transcriber/app.py &

# Wait to avoid ECONNREFUSED
sleep 5

# Start Node.js app
echo "🚀 Starting Node.js server..."
node dist/server.js
