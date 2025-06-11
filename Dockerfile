# Etapa 1: Instalar dependencias
FROM node:20-slim AS deps
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package.json package-lock.json ./

# Instalar dependencias del sistema mínimas necesarias
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Instalar todas las dependencias (producción y desarrollo)
RUN npm ci

# Etapa 2: Construir la aplicación
FROM node:20-slim AS builder
WORKDIR /app

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa 3: Ejecutar la aplicación
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Instalar OpenSSL en la imagen final
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de producción para runtime
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar archivos necesarios para producción
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma

# Regenerar cliente de Prisma en la imagen final con los binarios correctos
RUN npx prisma generate

# Puerto que expone la aplicación Next.js
EXPOSE 3000

CMD ["npm", "start"] 