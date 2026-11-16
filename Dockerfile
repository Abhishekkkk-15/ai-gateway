# ==============================================================================
# Multi-stage Dockerfile for AI Gateway (Backend API + Embedded Dashboard)
# ==============================================================================

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ------------------------------------------------------------------------------
# Builder Stage
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy dependency definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/tsconfig ./packages/tsconfig
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/provider-groq/package.json ./packages/provider-groq/
COPY packages/provider-nvidia/package.json ./packages/provider-nvidia/
COPY packages/provider-google/package.json ./packages/provider-google/
COPY packages/provider-elevenlabs/package.json ./packages/provider-elevenlabs/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy full source tree
COPY . .

# Build all packages and apps (web dashboard + gateway + providers)
RUN pnpm build

# ------------------------------------------------------------------------------
# Runner Stage
# ------------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy workspace package manifests & production dependencies
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/.npmrc /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/tsconfig ./packages/tsconfig
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/provider-groq/package.json ./packages/provider-groq/
COPY --from=builder /app/packages/provider-groq/dist ./packages/provider-groq/dist
COPY --from=builder /app/packages/provider-nvidia/package.json ./packages/provider-nvidia/
COPY --from=builder /app/packages/provider-nvidia/dist ./packages/provider-nvidia/dist
COPY --from=builder /app/packages/provider-google/package.json ./packages/provider-google/
COPY --from=builder /app/packages/provider-google/dist ./packages/provider-google/dist
COPY --from=builder /app/packages/provider-elevenlabs/package.json ./packages/provider-elevenlabs/
COPY --from=builder /app/packages/provider-elevenlabs/dist ./packages/provider-elevenlabs/dist
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/node_modules ./apps/gateway/node_modules

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "apps/gateway/dist/index.js"]
