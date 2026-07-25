# ==========================================
# Stage 1: Build NestJS Application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build dist assets
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production Runtime Environment
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install Chromium & dependencies required by Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    APP_ENV=uat \
    PORT=8000

# Copy node_modules & build artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/core/properties ./dist/src/core/properties
COPY --from=builder /app/src/core/properties ./dist/core/properties

# Expose port
EXPOSE 8000

# Start production server
CMD ["node", "dist/main.js"]
