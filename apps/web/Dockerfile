# ---- Build stage ----
FROM node:22-slim AS builder

WORKDIR /app

# Build deps for native modules if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (full lockfile install for reproducibility)
COPY package.json package-lock.json* ./
# If lockfile absent fall back to npm install; pnpm/npm both supported by mounting lockfile.
RUN if [ -f package-lock.json ]; then npm ci; \
    else npm install --no-audit --no-fund; fi

COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src

RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine AS runtime

# Project nginx config (try_files + /api/ reverse proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]