FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/collab/package.json ./packages/collab/
RUN pnpm install --filter @quire/collab --frozen-lockfile || pnpm install --filter @quire/collab

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/collab/node_modules ./packages/collab/node_modules
COPY packages/collab ./packages/collab
COPY package.json pnpm-workspace.yaml ./
RUN pnpm --filter @quire/collab build

FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/packages/collab/dist ./dist
COPY --from=builder /app/packages/collab/package.json ./
COPY --from=deps /app/packages/collab/node_modules ./node_modules

ENV COLLAB_PORT=1234
EXPOSE 1234
CMD ["node", "dist/index.js"]
