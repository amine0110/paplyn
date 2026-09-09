FROM node:22-bookworm AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/web/package.json ./packages/web/
RUN pnpm install --filter @paplyn/web --frozen-lockfile || pnpm install --filter @paplyn/web

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY packages/web ./packages/web
COPY package.json pnpm-workspace.yaml ./
# Needed by pap-54-secrets.deploy-gate.test.ts during image build
COPY .env.example ./
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_COLLAB_URL
ARG NEXT_PUBLIC_DEPLOYMENT_MODE
ARG NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED=true
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_COLLAB_URL=$NEXT_PUBLIC_COLLAB_URL
ENV NEXT_PUBLIC_DEPLOYMENT_MODE=$NEXT_PUBLIC_DEPLOYMENT_MODE
ENV NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED=$NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED
RUN cd packages/web && pnpm test && pnpm build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/packages/web/public ./public
COPY --from=builder /app/packages/web/templates ./templates
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules /node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/src/lib/schema.ts ./src/lib/schema.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/src/lib/db-migrate.ts ./src/lib/db-migrate.ts
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
