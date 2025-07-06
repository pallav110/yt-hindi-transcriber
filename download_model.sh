#!/bin/bash

mkdir -p vosk-model
cd vosk-model
curl -LO https://alphacephei.com/vosk/models/vosk-model-hi-0.22.zip
unzip vosk-model-hi-0.22.zip
rm vosk-model-hi-0.22.zip
