# Multi-stage Dockerfile for Next.js + Prisma (PostgreSQL)

FROM node:24-alpine

# Use a dummy DATABASE_URL at build time so prisma generate/build work
# without requiring a real DB connection. The real URL is provided at runtime.
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app

# Install cron and other required packages
RUN apk add --no-cache openssl dcron

# Copy source and install dependencies as root (needed for npm ci)
COPY . .
RUN npm ci

RUN npx prisma generate

# Build Next.js application
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build

# Make scripts executable
RUN chmod +x scripts/cleanup.sh scripts/entrypoint.sh

# Setup cron job for root's crontab (crond requires root)
RUN crontab scripts/crontab

# Create a non-root user and give ownership of app files
RUN addgroup -S snowshare && adduser -S snowshare -G snowshare \
    && mkdir -p uploads .tus-temp \
    && chown -R snowshare:snowshare /app

# Default command via entrypoint (starts crond as root, then drops to snowshare)
ENTRYPOINT ["sh", "scripts/entrypoint.sh"]
