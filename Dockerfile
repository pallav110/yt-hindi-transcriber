# 🐧 Use official Node base image with Python included
FROM node:18

# 🛠️ Install Python, pip, ffmpeg, unzip
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl unzip && \
    apt-get clean

# 🧠 Install Python dependencies
COPY transcriber/requirements.txt /tmp/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r /tmp/requirements.txt

# 🔧 Create app directory
WORKDIR /app

# 📦 Copy everything into container
COPY . .
# ✅ Make both shell scripts executable
RUN chmod +x download_model.sh start.sh

# 🏗️ Build TypeScript
RUN npm install && npm run build

# 🌐 Expose app port
EXPOSE 8080


# Download and unzip Vosk model only if not present (use Railway persistent volume mounted at /app/vosk-model)
RUN if [ ! -d "/app/vosk-model/vosk-model-hi-0.22" ]; then \
      ./download_model.sh && \
      unzip vosk-model-hi-0.22.zip -d /app/vosk-model; \
    fi

# Expose port
EXPOSE 8080

# Start combined service
CMD ["./start.sh"]
