#!/bin/bash

# Download Vosk Hindi model if not already present
if [ ! -d "vosk-model/vosk-model-hi-0.22" ]; then
  echo "🔽 Downloading Hindi Vosk model..."
  ./download_model.sh
else
  echo "✅ Vosk model already exists."
fi

# Start Flask in background
python3 transcribe.py &

# Start Node.js server
node dist/server.js
