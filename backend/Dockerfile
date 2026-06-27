# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and config files
COPY tsconfig.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/

# Compile TypeScript
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output and migrations from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
