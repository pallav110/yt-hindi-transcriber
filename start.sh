#!/bin/bash

# Run Flask server in background
python3 transcribe.py &

# Run Node server in foreground
node dist/server.js
