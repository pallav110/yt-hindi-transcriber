# Use official Node + Python base image
FROM node:18

# Install Python, ffmpeg, unzip, curl
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && apt-get clean

# Copy requirements and install Python deps
COPY transcriber/requirements.txt /tmp/
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# Create app dir and copy source
WORKDIR /app
COPY . .

# Make shell scripts executable if any
RUN chmod +x ./start.sh ./download_model.sh

# Build TypeScript
RUN npm install && npm run build

# Download and unzip Vosk model only if not present (use Railway persistent volume mounted at /app/vosk-model)
RUN if [ ! -d "/app/vosk-model/vosk-model-hi-0.22" ]; then \
      ./download_model.sh && \
      unzip vosk-model-hi-0.22.zip -d /app/vosk-model; \
    fi

# Expose port
EXPOSE 8080

# Start combined service
CMD ["./start.sh"]
