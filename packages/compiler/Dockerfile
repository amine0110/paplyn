FROM node:20-bookworm AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM texlive/texlive:latest AS texlive

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/compiler/package.json ./packages/compiler/
RUN pnpm install --filter @quire/compiler --frozen-lockfile || pnpm install --filter @quire/compiler

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/compiler/node_modules ./packages/compiler/node_modules
COPY packages/compiler ./packages/compiler
COPY package.json pnpm-workspace.yaml ./
RUN pnpm --filter @quire/compiler build

FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=texlive /usr/local/texlive /usr/local/texlive
ENV PATH="/usr/local/texlive/2024/bin/x86_64-linux:/usr/local/texlive/2023/bin/x86_64-linux:/usr/local/texlive/2022/bin/x86_64-linux:$PATH"

WORKDIR /app
COPY --from=builder /app/packages/compiler/dist ./dist
COPY --from=builder /app/packages/compiler/package.json ./
COPY --from=deps /app/packages/compiler/node_modules ./node_modules
COPY --from=deps /app/node_modules /node_modules

ENV COMPILER_PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
