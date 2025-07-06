#!/bin/bash

mkdir -p transcriber/vosk-model
cd transcriber/vosk-model
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip
unzip vosk-model-small-hi-0.22.zip
rm vosk-model-small-hi-0.22.zip
