# Multi-stage Dockerfile for Next.js + Prisma (PostgreSQL)

FROM node:20-alpine

WORKDIR /app

# Install cron and other required packages
RUN apk add --no-cache openssl dcron

# Copy the rest of the source
COPY . .
RUN npm ci
RUN npx prisma generate

# Build Next.js application
ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build

# Make cleanup script executable
RUN chmod +x scripts/cleanup.sh

# Setup cron job
RUN crontab scripts/crontab


# Default command - use custom server for streaming uploads
CMD ["sh", "-c", "npx prisma migrate deploy && crond && node server.js"]
