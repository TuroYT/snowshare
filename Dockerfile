# Multi-stage Dockerfile for Next.js + Prisma (PostgreSQL)

FROM node:24-alpine

# Use a dummy DATABASE_URL at build time so prisma generate/build work
# without requiring a real DB connection. The real URL is provided at runtime.
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app

# Install required packages
RUN apk add --no-cache openssl

# Copy source and install dependencies as root (needed for npm ci)
COPY . .
RUN npm install

RUN npx prisma generate

# Build Next.js application
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build

# Make scripts executable
RUN chmod +x scripts/cleanup.sh scripts/entrypoint.sh

# Create a non-root user and give ownership of writable directories only
# chmod 777 on writable dirs so custom UIDs (e.g. user: 1011:1011) can write too
RUN addgroup -S snowshare && adduser -S snowshare -G snowshare \
    && mkdir -p uploads .tus-temp \
    && chown -R snowshare:snowshare uploads .tus-temp src/generated .next \
    && chmod -R 777 uploads .tus-temp src/generated

# Default command via entrypoint (drops to snowshare user; cleanup runs via node-cron)
ENTRYPOINT ["sh", "scripts/entrypoint.sh"]
