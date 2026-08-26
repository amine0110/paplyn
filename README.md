# Paplyn

Collaborative LaTeX for researchers and students. Write, compile, and share documents in real time.

**Live:** [paplyn.com](https://paplyn.com) (formerly Plicum / plicum.com — legacy domain redirects to paplyn.com)

The public product name is **Paplyn**. This repository is [amine0110/paplyn](https://github.com/amine0110/paplyn) on GitHub; internal npm and Docker identifiers use the `@paplyn` scope.

Product name, tagline, and UI copy are defined in [`packages/web/src/lib/product.ts`](packages/web/src/lib/product.ts). Override the public name with `PRODUCT_NAME` or `NEXT_PUBLIC_PRODUCT_NAME` if needed.

## Deployment

Paplyn runs in two modes, controlled by `DEPLOYMENT_MODE` and `NEXT_PUBLIC_DEPLOYMENT_MODE`:

| Mode | Use case |
|------|----------|
| **Hosted (SaaS)** | Multi-tenant cloud at [paplyn.com](https://paplyn.com). Stripe billing, plan limits, managed infrastructure. |
| **Self-hosted** | Single organization on your own server via Docker Compose. No billing UI; first registered user becomes admin. |

Both modes share the same codebase and feature set. Self-hosting is the supported path for running from this repository.

## Features

- **Multi-file LaTeX editor** — CodeMirror 6 with syntax highlighting, autocomplete, search/replace, go-to-line, and word count
- **PDF compile and preview** — pdfLaTeX, XeLaTeX, or LuaLaTeX; BibTeX and Biber bibliography passes; compile log with jump-to-error
- **SyncTeX** — Click in the PDF preview to jump to the matching source line
- **Real-time collaboration** — Yjs shared editing with presence indicators; room state persisted to PostgreSQL
- **Project files** — Folders, rename/move, image and PDF preview, source zip download, Overleaf-style zip import
- **Sharing** — Email invites with owner/editor/viewer roles
- **Version history** — Automatic revisions with restore
- **Templates** — Blank article, IEEE conference, thesis chapter, Beamer slides
- **AI assistant** — Optional Groq on hosted deployments, or any OpenAI-compatible provider for self-hosting
- **Themes** — Light, dark, and system appearance

## Self-host quickstart (Docker)

```bash
git clone https://github.com/amine0110/paplyn.git
cd paplyn
cp .env.example .env
# Set BETTER_AUTH_SECRET and COLLAB_SECRET to random strings (32+ chars)

docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start a project. The first registered user becomes admin in self-hosted mode.

Database migrations run automatically when the web container starts. To run them manually:

```bash
docker compose --profile migrate run --rm migrate
```

### Production behind a reverse proxy

Bind services to localhost and put nginx, Caddy, or similar in front of the web app:

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET, COLLAB_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL,
# NEXT_PUBLIC_COLLAB_URL, and other values for your domain (do not commit .env)
# SaaS example: BETTER_AUTH_URL=https://paplyn.com, NEXT_PUBLIC_APP_URL=https://paplyn.com

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

`docker-compose.prod.yml` overrides port bindings to `127.0.0.1` only.

For Caddy on the production VPS, see [`deploy/caddy/Caddyfile`](deploy/caddy/Caddyfile) (paplyn.com canonical; plicum.com redirects).

### Services

| Service | Port | Description |
|---------|------|-------------|
| web | 3000 | Next.js application |
| compiler | 3001 | LaTeX compile worker (TeX Live) |
| collab | 1234 | Yjs WebSocket server |
| postgres | 5432 | PostgreSQL 16 |

## Local development

### Prerequisites

- Node.js 22+
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
pnpm --filter @paplyn/compiler dev

# Terminal 2 — collab server
pnpm --filter @paplyn/collab dev

# Terminal 3 — web app
pnpm --filter @paplyn/web dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Compile without local TeX Live

Run only the compiler container:

```bash
docker compose up compiler -d
```

Set `COMPILER_URL=http://localhost:3001` in `.env`.

## Environment variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DEPLOYMENT_MODE` | `saas` or `selfhosted` |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (32+ chars) |
| `BETTER_AUTH_URL` | Public URL of the web app (required in production) |
| `NEXT_PUBLIC_APP_URL` | Browser-facing app URL |
| `NEXT_PUBLIC_COLLAB_URL` | WebSocket URL for collaboration |
| `COLLAB_SECRET` | Token signing for WebSocket auth |
| `COMPILER_URL` | Compile service URL |
| `GROQ_API_KEY` | Enables AI assistant on hosted (SaaS) deployments using Groq |
| `OPENAI_API_KEY` | Enables AI assistant via BYO OpenAI or self-hosted env fallback |
| `OPENAI_BASE_URL` | OpenAI-compatible API base URL (default `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | Model override (`openai/gpt-oss-120b` with Groq; fallback `openai/gpt-oss-20b`; `gpt-4o-mini` with OpenAI) |
| `STRIPE_*` | Stripe keys and price IDs (SaaS mode only) |

## Testing

```bash
pnpm test
```

Unit tests cover config, templates, collab tokens, compile logic, and validation. API integration tests require a running database.

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
- **Collab** — y-websocket server, one room per project, HMAC token auth, Postgres persistence
- **Compiler** — Isolated worker with compile timeout, file size limits, and no outbound network

## Known limitations

- Stripe webhook handler for automatic subscription sync is not included; plan changes can be assigned manually in the database
- Binary project files (images, PDFs) are stored as base64 in PostgreSQL — fine for typical project sizes, not ideal at very large scale

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
