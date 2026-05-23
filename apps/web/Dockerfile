FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/scanner/package.json ./packages/scanner/
COPY packages/billing/package.json ./packages/billing/
COPY packages/ai/package.json ./packages/ai/
COPY packages/report/package.json ./packages/report/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ui/package.json ./packages/ui/
COPY packages/monitoring/package.json ./packages/monitoring/
COPY packages/crawler/package.json ./packages/crawler/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/api-sdk/package.json ./packages/api-sdk/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @beacon/shared build && \
    pnpm --filter @beacon/db build && \
    pnpm --filter @beacon/scanner build && \
    pnpm --filter @beacon/ai build && \
    pnpm --filter @beacon/report build && \
    pnpm --filter @beacon/ui build
RUN pnpm --filter @beacon/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
