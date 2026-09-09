---
title: Configuration
description: Environment variables, API keys, and URLs for self-hosting Paplyn.
section: Self-hosting
order: 1
slug: configuration
---

This guide covers every setting you need to run Paplyn on your own server. Start from the repository root.

## 1. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` with your values. **Never commit `.env`** — it is listed in `.gitignore`.

For Docker, the same file is read by `docker compose`. For local development, place it at the repository root.

## 2. Required core settings

These must be set for the app, collab server, and compiler to work together.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (shared by web and collab) |
| `BETTER_AUTH_SECRET` | Session signing secret — use a random string, 32+ characters |
| `BETTER_AUTH_URL` | Public URL of the web app (e.g. `https://paplyn.example.com`) |
| `COLLAB_SECRET` | Secret for signing WebSocket collaboration tokens |
| `NEXT_PUBLIC_APP_URL` | Browser-facing app URL (same origin as users visit) |
| `NEXT_PUBLIC_COLLAB_URL` | WebSocket URL for real-time editing (e.g. `wss://paplyn.example.com`) |
| `COMPILER_URL` | Internal HTTP URL of the compile service (e.g. `http://compiler:3001` in Docker) |

In Docker Compose, `postgres`, `compiler`, `collab`, and `web` services are wired automatically when you use the defaults in `.env.example`. See the [README](https://github.com/amine0110/paplyn#self-host-quickstart-docker) for `docker compose up --build`.

## 3. Deployment mode

| Variable | Values | Notes |
|----------|--------|-------|
| `DEPLOYMENT_MODE` | `selfhosted` or `saas` | Server-side behavior |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `selfhosted` or `saas` | Controls UI (billing, admin features) |

For self-hosting, set both to `selfhosted`. The first registered user becomes admin. SaaS mode enables Stripe billing and hosted-specific admin tools.

## 4. AI assistant keys

The AI sidebar needs an OpenAI-compatible API. Where you put the key depends on how you deploy.

### Self-hosted (environment variables)

Set one of these in `.env`:

| Variable | When to use |
|----------|-------------|
| `OPENAI_API_KEY` | Any OpenAI-compatible provider (OpenAI, local proxy, etc.) |
| `OPENAI_BASE_URL` | API base URL (default `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | Model name (default `gpt-4o-mini` for OpenAI) |
| `GROQ_API_KEY` | Groq on hosted-style setups; ignored in strict self-hosted org mode |

Legacy: a `gsk-` prefixed key in `XAI_API_KEY` or `OPENAI_API_KEY` is treated as Groq when `GROQ_API_KEY` is unset.

### Hosted admin UI (SaaS / paplyn.com)

Organization admins can set keys in **Admin → Settings** without redeploying:

- OpenAI-compatible API key
- Base URL
- Model name

These database-stored values take precedence over `OPENAI_*` env vars for that organization in self-hosted mode.

## 5. Optional OAuth sign-in

Social login buttons appear only when the matching client ID and secret are set. Leave them empty to hide the button.

| Provider | Variables |
|----------|-----------|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| ORCID | `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET` |

Callback URLs follow Better Auth conventions, e.g. `https://your-domain.com/api/auth/callback/github`. See [Connect ORCID](/docs/orcid) for ORCID-specific setup.

## 6. Optional SMTP (invite emails)

Invite emails are skipped when SMTP is not configured.

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.example.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your SMTP username |
| `SMTP_PASS` | your SMTP password |
| `SMTP_FROM` | `Paplyn <noreply@your-domain.com>` |

## 7. Optional Stripe (SaaS only)

Only needed when `DEPLOYMENT_MODE=saas`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STUDENT`, `STRIPE_PRICE_RESEARCHER`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 8. Optional user reports and Turnstile

The **Report an issue** form (`/report`) is hidden unless both a Notion token and database ID are set.

| Variable | Purpose |
|----------|---------|
| `NOTION_USER_REPORTS_TOKEN` | Notion integration token (or `NOTION_TOKEN`) |
| `NOTION_USER_REPORTS_DATABASE_ID` | Your Notion database ID for incoming reports |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret (optional bot protection) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key (shown in the form when set) |

Create a Notion database with properties matching the app (title, What happened, Steps, Status, etc.) or adapt your schema. Honeypot and rate limits still apply when Turnstile is unset.

## 9. Docker and production reverse proxy

**Quickstart:**

```bash
cp .env.example .env
# Edit secrets and URLs, then:
docker compose up --build
```

**Production** (bind to localhost, put Caddy/nginx in front):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

See `deploy/caddy/Caddyfile` for an example Caddy site block. Set `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_COLLAB_URL` to your public HTTPS origin before going live.

Migrations run when the web container starts. To run them manually:

```bash
docker compose --profile migrate run --rm migrate
```

## 10. Per-user integration keys (Settings)

Some keys are **not** server env vars — each user enters them in [**Settings**](/settings):

| Integration | Doc |
|-------------|-----|
| Zotero user ID and API key | [Connect Zotero](/docs/zotero) |
| ORCID (sign-in) | [Connect ORCID](/docs/orcid) |

These stay in the user's account and are never checked into your `.env`.

## Checklist before going live

1. `.env` copied and filled — no placeholder secrets
2. `BETTER_AUTH_SECRET` and `COLLAB_SECRET` are unique random strings
3. Public URLs use HTTPS and match your reverse proxy
4. `NEXT_PUBLIC_COLLAB_URL` uses `wss://` in production
5. Database backups configured for PostgreSQL
6. AI, OAuth, SMTP, and Notion vars set only if you need those features

For local development without Docker, see the README **Local development** section.
