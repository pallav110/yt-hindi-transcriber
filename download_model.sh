#!/bin/bash

echo "🔍 Checking if Vosk model is already downloaded..."

mkdir -p vosk-model
cd vosk-model

if [ ! -d "vosk-model-hi-0.22" ]; then
  echo "📦 Downloading Vosk Hindi large model..."
  curl -L -o model.zip https://alphacephei.com/vosk/models/vosk-model-hi-0.22.zip
  unzip model.zip
  rm model.zip
else
  echo "✅ Vosk model already present."
fi
