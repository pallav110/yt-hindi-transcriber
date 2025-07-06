#!/bin/bash

# Download model if not already present
./download_model.sh

# Start Flask backend
python3 transcribe.py &

# Start Node server
node dist/server.js
