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
# Kısıtlı RAM'li sunucuda OOM önlemek için Node heap tavanı (3.8G RAM + swap'a uygun)
ENV NODE_OPTIONS="--max-old-space-size=3072"
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
# Prisma CLI (migrate deploy için)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Startup script'i kopyala (CRLF → LF dönüşümü dahil)
COPY startup.sh ./startup.sh
RUN sed -i 's/\r$//' startup.sh && chmod +x startup.sh && chown nextjs:nodejs startup.sh

# Dinamik migration uygulayıcı (startup.sh tarafından çağrılır; prisma CLI gerektirmez)
COPY --chown=nextjs:nodejs apply-migrations.js ./apply-migrations.js

# Demo bayi (tenant) oluşturma scripti — elle çalıştırılır (docker exec node create-demo-tenants.js)
COPY --chown=nextjs:nodejs create-demo-tenants.js ./create-demo-tenants.js

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# startup.sh: 1) migration resolve 2) migrate deploy 3) SQL fallback 4) server
CMD ["sh", "startup.sh"]
