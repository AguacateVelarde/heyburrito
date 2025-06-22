# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for development)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application in development mode with hot reload
CMD ["npm", "run", "start:dev"]