# Use Node.js 20 with Python support
FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install edge-tts globally (--break-system-packages for Python 3.11+)
# Pinned: 7.3.0+ fixes Microsoft's Oct 2026 Sec-MS-GEC v2 change (403 handshake
# errors, rany2/edge-tts#490). Bumping this line also invalidates Docker's layer
# cache so new deploys always pick up the current fix.
RUN pip3 install --break-system-packages edge-tts==7.3.1

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install npm dependencies
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Expose port
EXPOSE 3000

# Start the production server
CMD ["npm", "start"]
