#!/bin/bash

MODEL_DIR="transcriber/vosk-model/vosk-model-small-hi-0.22"

if [ -d "$MODEL_DIR" ]; then
  echo "✅ Model already exists, skipping download"
  exit 0
fi

mkdir -p transcriber/vosk-model
cd transcriber/vosk-model

echo "📦 Downloading Vosk Hindi model..."
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip

unzip vosk-model-small-hi-0.22.zip
rm vosk-model-small-hi-0.22.zip

# ✅ Flatten the structure if needed (only if extra nesting happens)
if [ -d "vosk-model-small-hi-0.22/vosk-model-small-hi-0.22" ]; then
  mv vosk-model-small-hi-0.22/vosk-model-small-hi-0.22 ./temp
  rm -rf vosk-model-small-hi-0.22
  mv temp vosk-model-small-hi-0.22
fi

echo "✅ Model downloaded and extracted."
