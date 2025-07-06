FROM node:18

# Install Python and required system tools
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && \
    pip3 install flask vosk pydub

# Set work directory
WORKDIR /app

# Copy everything
COPY . .

# Make scripts executable
RUN chmod +x start.sh download_model.sh

# Build TypeScript
RUN npm install && npx tsc

# Expose both ports
EXPOSE 3000 5000

# Start both Flask + Node.js
CMD ["./start.sh"]
