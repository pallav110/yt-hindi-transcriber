FROM node:18

# Install Python + system packages
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && \
    pip3 install --break-system-packages flask vosk pydub

# Set working directory
WORKDIR /app

# Copy app files
COPY . .

# Build TypeScript
RUN npm install && npx tsc

# Download and extract Vosk model once inside container
RUN curl -L -o vosk-model.zip https://alphacephei.com/vosk/models/vosk-model-hi-0.22.zip && \
    unzip vosk-model.zip -d vosk-model && rm vosk-model.zip

# Make startup script executable
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose Flask and Node ports
EXPOSE 5000 3000

CMD ["/start.sh"]
