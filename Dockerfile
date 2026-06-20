FROM node:18-bullseye-slim

# Install system compilers for the execution judge
RUN apt-get update && apt-get install -y \
    g++ \
    default-jdk-headless \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package configurations
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
