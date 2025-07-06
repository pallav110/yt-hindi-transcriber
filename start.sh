#!/bin/bash

# ✅ Download Hindi Vosk model at runtime to keep image small
if [ ! -d "transcriber/vosk-model/vosk-model-small-hi-0.22" ]; then
  echo "🔽 Downloading Hindi Vosk model..."
  ./download_model.sh
else
  echo "✅ Vosk model already exists."
fi

node dist/server.js
