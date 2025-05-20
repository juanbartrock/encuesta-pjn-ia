# Etapa 1: Instalar dependencias
FROM node:20-alpine AS deps
WORKDIR /app

# Copiar package.json y package-lock.json (o yarn.lock o pnpm-lock.yaml)
COPY package.json package-lock.json ./
RUN cat package.json

# Instalar dependencias
RUN npm install
RUN npm list bcryptjs || (echo "bcryptjs no encontrado después de npm install" && exit 1)

# Etapa 2: Construir la aplicación
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de entorno para la construcción (si son necesarias)
# ENV NEXT_PUBLIC_API_URL=http://localhost:3000/api

RUN npm run build

# Etapa 3: Ejecutar la aplicación
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Descomentar la siguiente línea si estás usando el standalone output de Next.js
# ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/public ./public
# Descomentar y ajustar si estás usando el standalone output de Next.js
# COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar el build de Next.js (si no es standalone)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Puerto que expone la aplicación Next.js
EXPOSE 3000

# Usuario para ejecutar la aplicación (opcional, buena práctica)
# USER nextjs

CMD ["npm", "start"] 