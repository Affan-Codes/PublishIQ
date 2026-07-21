FROM node:20-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /usr/src/app

# Install OS dependencies and Playwright Chromium binary
RUN apt-get update && apt-get install -y ffmpeg python3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --only=production
RUN npx playwright install --with-deps chromium

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 4000

# Use non-root user (PROD-004)
USER node

CMD ["node", "dist/api.js"]
