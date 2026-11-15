FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies required for native builds / prisma on alpine
RUN apk add --no-cache libc6-compat openssl

# Copy package manifests and Prisma schema (needed by npm postinstall)
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (runs postinstall: prisma generate)
RUN npm ci

# Copy remaining project files
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy"
ENV JWT_SECRET="build-time-secret"
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations and start app
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
