FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port (Render sets PORT automatically)
EXPOSE 3001

CMD ["npm", "start"]

