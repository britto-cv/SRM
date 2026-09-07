# Use the official Playwright image which includes all browser dependencies
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

# Create app directory
WORKDIR /usr/src/app

# Copy root package files to handle workspaces
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install dependencies (workspaces)
RUN npm install

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build the backend and shared packages (if necessary)
RUN npm run build --workspace=backend

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "run", "start", "--workspace=backend"]
