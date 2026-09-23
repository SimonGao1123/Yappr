# Build stage: install deps and build frontend into backend/public
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Generates the Prisma client into backend/generated/prisma (npm run build also
# runs this, but doing it explicitly keeps the failure mode obvious).
RUN npx prisma generate
RUN npm run build

# Run stage: production deps + tsx to run server
FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install tsx --no-save

# Carries the generated Prisma client too, since it lives in backend/generated
COPY --from=builder /app/backend ./backend

ENV NODE_ENV=production
# Prisma reads TIMESTAMP columns as UTC; pin the container so serialised
# timestamps match what the mysql2 driver used to produce.
ENV TZ=UTC
EXPOSE 3000

CMD ["npx", "tsx", "backend/server.ts"]
