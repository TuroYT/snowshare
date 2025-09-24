# Multi-stage Dockerfile for Next.js + Prisma (PostgreSQL)

FROM node:20-alpine

WORKDIR /app


# Generate Prisma client and engines for this platform


# Copy the rest of the source
COPY . .
RUN apk add --no-cache openssl
RUN npm ci
RUN npx prisma generate

# Build Next.js application

ENV NODE_ENV=production
ENV PORT=3000
RUN npm run build


# Default command; migrations can be handled by compose command override
CMD ["npm", "start"]
