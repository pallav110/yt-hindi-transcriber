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

# 🚀 Run app
CMD ["./start.sh"]
