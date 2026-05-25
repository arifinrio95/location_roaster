# Use the official Node.js 20 image as the base
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building Vite)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the React frontend (compiles to dist/)
RUN npm run build

# Expose port (Cloud Run will inject the PORT env variable, typically 8080)
EXPOSE 8080

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=8080

# Start the application using tsx
CMD ["npm", "start"]
