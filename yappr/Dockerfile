# Build stage: install deps and build frontend into backend/public
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Run stage: production deps + tsx to run server
FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install tsx --no-save

COPY --from=builder /app/backend ./backend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npx", "tsx", "backend/server.ts"]
