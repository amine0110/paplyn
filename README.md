# Plicum

Public product name, tagline, and UI metadata live in
[`packages/web/src/lib/product.ts`](packages/web/src/lib/product.ts) (`PRODUCT_NAME`).
Override with `PRODUCT_NAME` / `NEXT_PUBLIC_PRODUCT_NAME` if needed.

Collaborative LaTeX for researchers and students. Write, compile, and share documents in real time — hosted as SaaS or self-hosted on your infrastructure.

## Features

- **Multi-file LaTeX editor** — CodeMirror 6 with syntax highlighting, line numbers, bracket matching
- **Live PDF preview** — Compile with pdfLaTeX or XeLaTeX, jump to errors from the log
- **Real-time collaboration** — Yjs-based shared editing with presence (self-hostable, no vendor lock-in)
- **AI assistant** — OpenAI-compatible chat for explaining errors, tightening prose, adding citations
- **Project templates** — Blank article, IEEE conference, thesis chapter, Beamer slides (all compile out of the box)
- **Two deployment modes** — SaaS with Stripe billing, or self-hosted single-organization install

## Quick start (Docker)

The fastest way to run the app:

```bash
cp .env.example .env
# Edit .env — at minimum set BETTER_AUTH_SECRET and COLLAB_SECRET to random strings

docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start writing. The first registered user becomes admin in self-hosted mode.

### Production (VPS)

On a server, bind services to localhost only and put a reverse proxy (nginx, Caddy, etc.) in front of the web app. Use the production overlay so Compose replaces default `0.0.0.0` port binds instead of adding duplicate ones:

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET, COLLAB_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL,
# NEXT_PUBLIC_COLLAB_URL, and other values for your domain (do not commit .env)

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

`docker-compose.prod.yml` publishes postgres (5432), compiler (3001), collab (1234), and web (3000) on `127.0.0.1` only via Compose `ports: !override`.

### Services

| Service   | Port | Description                    |
|-----------|------|--------------------------------|
| web       | 3000 | Next.js application            |
| compiler  | 3001 | LaTeX compile worker (TeX Live)|
| collab    | 1234 | Yjs WebSocket server           |
| postgres  | 5432 | PostgreSQL database            |

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- TeX Live (for local compilation) — or run only the compiler service via Docker

### Setup

```bash
cp .env.example .env

# Start Postgres (or use Docker for just the database)
docker run -d --name quire-db \
  -e POSTGRES_USER=quire -e POSTGRES_PASSWORD=quire -e POSTGRES_DB=quire \
  -p 5432:5432 postgres:16-alpine

pnpm install
pnpm db:push

# Terminal 1 — compiler (requires TeX Live locally, or use Docker)
pnpm --filter @quire/compiler dev

# Terminal 2 — collab server
pnpm --filter @quire/collab dev

# Terminal 3 — web app
pnpm --filter @quire/web dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Local compile without TeX Live

Run only the compiler container:

```bash
docker compose up compiler -d
```

Set `COMPILER_URL=http://localhost:3001` in `.env`.

### Tectonic fallback (dev)

For a lighter local compile option, install [Tectonic](https://tectonic-typesetting.github.io/) and adapt the compiler service. The Docker setup uses full TeX Live for IEEE/Beamer template support.

## Deployment modes

Set `DEPLOYMENT_MODE` and `NEXT_PUBLIC_DEPLOYMENT_MODE` to control behavior:

### Self-hosted (`DEPLOYMENT_MODE=selfhosted`)

- Single organization, no billing UI
- First registered user becomes admin
- Admin page at `/admin` for org name, AI keys, compile timeout
- No usage limits on compiles or AI

### SaaS (`DEPLOYMENT_MODE=saas`)

- Multi-tenant with plan limits
- Stripe Checkout + Customer Portal at `/settings/billing`
- Plans: Free, Student ($9/mo), Researcher ($29/mo)
- Requires `STRIPE_SECRET_KEY`, price IDs, and webhook secret

## Environment variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DEPLOYMENT_MODE` | `saas` or `selfhosted` |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (32+ chars) |
| `COLLAB_SECRET` | Token signing for WebSocket auth |
| `OPENAI_API_KEY` | Enables AI assistant (optional) |
| `COMPILER_URL` | Compile service URL |

## Testing

```bash
pnpm test
```

Tests cover config, templates, collab tokens, and validation logic. API integration tests require a running database.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js App │────▶│  PostgreSQL │
│  (Editor)   │     │   (API)      │     │             │
└──────┬──────┘     └──────┬───────┘     └─────────────┘
       │                   │
       │ WS                │ HTTP
       ▼                   ▼
┌─────────────┐     ┌──────────────┐
│   Collab    │     │   Compiler   │
│  (Yjs/WS)   │     │  (TeX Live)  │
└─────────────┘     └──────────────┘
```

- **Web** — Next.js App Router, Better Auth, Drizzle ORM, CodeMirror 6
- **Collab** — y-websocket server, one room per project, HMAC token auth
- **Compiler** — Isolated worker, sandboxed compiles (timeout, no network, size limits)

## Known gaps (v1)

- Dark mode not yet implemented
- Stripe webhook handler for subscription sync not included (manual plan assignment works)
- File rename not yet in UI (create new + delete old)
- PDF sync for binary uploads uses base64 in DB (fine for v1, not ideal at scale)
- Collab persistence is in-memory (documents reload from DB on reconnect)

## License

MIT — see [LICENSE](LICENSE).
