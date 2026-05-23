FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/scanner/package.json ./packages/scanner/
COPY packages/billing/package.json ./packages/billing/
COPY packages/ai/package.json ./packages/ai/
COPY packages/report/package.json ./packages/report/
COPY packages/monitoring/package.json ./packages/monitoring/
COPY packages/crawler/package.json ./packages/crawler/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/api-sdk/package.json ./packages/api-sdk/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @beacon/shared build && \
    pnpm --filter @beacon/db build && \
    pnpm --filter @beacon/scanner build && \
    pnpm --filter @beacon/ai build && \
    pnpm --filter @beacon/report build && \
    pnpm --filter @beacon/monitoring build && \
    pnpm --filter @beacon/crawler build && \
    pnpm --filter @beacon/notifications build
RUN pnpm --filter @beacon/worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs worker
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/worker/package.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
USER worker
EXPOSE 3001
CMD ["node", "dist/server.js"]
