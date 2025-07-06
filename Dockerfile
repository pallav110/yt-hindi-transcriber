FROM node:18

# Install Python + system packages
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && \
    pip3 install --break-system-packages flask vosk pydub

# Set working directory
WORKDIR /app

# Copy everything except the model
COPY . .

# Build TypeScript code
RUN npm install && npx tsc

# Add startup scripts
COPY start.sh /start.sh
COPY download_model.sh /download_model.sh
RUN chmod +x /start.sh /download_model.sh

# Expose both ports
EXPOSE 5000 3000

# Start both servers (and download model if needed)
CMD ["/start.sh"]
