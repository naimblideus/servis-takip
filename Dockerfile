# ============================================================
# Stage 1: deps — sadece bağımlılıkları kur
# ============================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Bağımlılıkları kur (devDependencies dahil; build için gerekli)
RUN npm ci

# ============================================================
# Stage 2: builder — uygulamayı derle
# ============================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# deps aşamasından node_modules'u kopyala
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client oluştur
RUN npx prisma generate

# Next.js standalone output için
ENV NEXT_TELEMETRY_DISABLED=1

# Build — NODE_ENV=production olarak ayarla
ENV NODE_ENV=production
RUN npm run build

# ============================================================
# Stage 3: runner — sadece çalışma zamanı dosyaları
# ============================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Güvenlik: root olmayan kullanıcı
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Public dosyaları kopyala
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Standalone build çıktısını kopyala
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma şemasını ve client'ı kopyala (runtime için)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Başlangıçta Prisma migration uygula, sonra uygulamayı başlat
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
