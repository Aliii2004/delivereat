FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Build vaqtida env kerak bo'lsa
ARG NEXT_PUBLIC_API_URL=http://localhost/api
ARG NEXT_PUBLIC_GRAPHQL_URL=http://localhost/graphql
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

RUN npm run build

# ─── PRODUCTION ────────────────────────────────────────────
# next.config.js da output: 'standalone' bor — shunga mos Dockerfile

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Standalone build barcha kerakli fayllarni o'z ichiga oladi
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
