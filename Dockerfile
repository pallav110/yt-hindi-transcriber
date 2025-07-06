FROM node:18

# Install Python + system packages
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && \
    pip3 install --break-system-packages flask vosk pydub

# Set working directory
WORKDIR /app

# Copy everything before setting permission
COPY . .

# Set execute permission (important: must refer to correct copied path inside container)
RUN chmod +x /app/start.sh /app/download_model.sh

# Build TypeScript
RUN npm install && npx tsc

# Expose Flask and Node ports
EXPOSE 5000 3000

# Use absolute path in CMD to avoid shell errors
CMD ["/app/start.sh"]
