# Multi-stage Dockerfile for Next.js + Prisma (PostgreSQL)

FROM node:24-alpine

WORKDIR /app

# Install required packages
RUN apk add --no-cache openssl

# Copy source and install dependencies as root (needed for npm ci)
COPY . .
RUN npm ci

# Use a dummy DATABASE_URL at build time so prisma generate/build work
# without requiring a real DB connection. Only used for these build steps,
# never persisted into the runtime image env — the real URL is provided
# at runtime via docker-compose/environment.
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy

RUN DATABASE_URL=${DATABASE_URL} npx prisma generate

# Build Next.js application
ENV NODE_ENV=production
ENV PORT=3000
RUN DATABASE_URL=${DATABASE_URL} npm run build

# Make scripts executable
RUN chmod +x scripts/entrypoint.sh

# Create a non-root user and give ownership of writable directories only.
# uploads/ also holds uploads/.tus-temp (created lazily by server.js at
# runtime) since the snowshare user owns the parent directory.
RUN addgroup -S snowshare && adduser -S snowshare -G snowshare \
    && mkdir -p uploads \
    && chown -R snowshare:snowshare uploads src/generated .next

# Switch to non-root user for runtime
USER snowshare

# Lightweight liveness/readiness check hitting an existing, unauthenticated endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/api/setup/check || exit 1

# Default command via entrypoint (cleanup runs via node-cron)
ENTRYPOINT ["sh", "scripts/entrypoint.sh"]
