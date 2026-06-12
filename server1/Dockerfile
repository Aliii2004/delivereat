FROM node:20-alpine AS builder

WORKDIR /app

# Prisma ishlashi uchun Alpine tizimiga OpenSSL paketini o'rnatamiz
RUN apk add --no-cache openssl

# Dependencies o'rnatish
COPY package*.json ./
RUN npm ci

# Prisma client generatsiya
COPY prisma ./prisma/
RUN npx prisma generate

# Source code ni ko'chirish va build qilish
COPY . .
RUN npm run build

# ─── PRODUCTION IMAGE ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl

# Production dependencies va build artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Migration va startup script
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# Entrypoint script yaratish
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo 'echo "Running Prisma migrations..."' >> /app/entrypoint.sh && \
    echo 'npx prisma migrate deploy' >> /app/entrypoint.sh && \
    echo 'echo "Starting server..."' >> /app/entrypoint.sh && \
    echo 'exec node dist/index.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
