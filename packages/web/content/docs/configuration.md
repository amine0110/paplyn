---
title: Configuration
description: Environment variables, API keys, and URLs for self-hosting Paplyn.
section: Self-hosting
order: 1
slug: configuration
---

This guide tells you **where to put each setting** when self-hosting Paplyn. All secrets live in `.env` on your server (or in Docker Compose `environment:` overrides) — never in the git repository.

## Setup

```bash
cp .env.example .env
```

Edit `.env` at the repository root. **Never commit `.env`.** Docker Compose reads the same file automatically.

---

## Required

These must be set for the web app, collab server, and compiler to work.

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `.env` | PostgreSQL connection string (shared by web and collab) |
| `BETTER_AUTH_SECRET` | `.env` | Session signing secret — random string, 32+ characters |
| `BETTER_AUTH_URL` | `.env` | Public HTTPS URL of the web app (e.g. `https://paplyn.example.com`) |
| `COLLAB_SECRET` | `.env` | Secret for signing WebSocket collaboration tokens |
| `NEXT_PUBLIC_APP_URL` | `.env` | Browser-facing app URL (same origin users visit) |
| `NEXT_PUBLIC_COLLAB_URL` | `.env` | WebSocket URL (`wss://` in production) |
| `COMPILER_URL` | `.env` | Internal compile service URL (e.g. `http://compiler:3001` in Docker) |
| `DEPLOYMENT_MODE` | `.env` | Set `selfhosted` for single-org installs |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `.env` | Set `selfhosted` to match |

The first registered user becomes admin in self-hosted mode.

**Docker quickstart:** `docker compose up --build` — see the [README](https://github.com/amine0110/paplyn#self-host-quickstart-docker).

**Production:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` behind Caddy or nginx. Example Caddy config: `deploy/caddy/Caddyfile`.

---

## Auth (optional — Google, GitHub, ORCID)

Social sign-in buttons appear **only when both** the client ID and client secret are set in `.env`. Email/password sign-in always works.

Set these on the **web service** at runtime (`.env` or compose `environment:`). Never commit real values.

### Google

| Variable | Where |
|----------|-------|
| `GOOGLE_CLIENT_ID` | `.env` |
| `GOOGLE_CLIENT_SECRET` | `.env` |

**Google Cloud Console** — create an OAuth 2.0 Client ID (Web application) and add this **Authorized redirect URI** (replace the host with your `BETTER_AUTH_URL` origin):

```
https://<your-paplyn-host>/api/auth/callback/google
```

Example: if `BETTER_AUTH_URL=https://paplyn.example.com`, use `https://paplyn.example.com/api/auth/callback/google`.

The **Continue with Google** button is hidden when either variable is unset.

### GitHub

| Variable | Where |
|----------|-------|
| `GITHUB_CLIENT_ID` | `.env` |
| `GITHUB_CLIENT_SECRET` | `.env` |

**GitHub → Settings → Developer settings → OAuth Apps** — set the **Authorization callback URL** to:

```
https://<your-paplyn-host>/api/auth/callback/github
```

The **Continue with GitHub** button is hidden when either variable is unset.

### ORCID

| Variable | Where |
|----------|-------|
| `ORCID_CLIENT_ID` | `.env` |
| `ORCID_CLIENT_SECRET` | `.env` |

Register a **Public API** client at ORCID and set the redirect URI to:

```
https://<your-paplyn-host>/api/auth/callback/orcid
```

Paplyn uses Better Auth `^1.2.3`, which registers OAuth callbacks at `/api/auth/callback/:providerId`. See [ORCID sign-in](/docs/orcid) for step-by-step ORCID developer setup.

The **Continue with ORCID** button is hidden when either variable is unset.

---

## Email / SMTP (optional — invite & password-reset emails)

SMTP credentials are **only** read from environment variables. They are never hard-coded in the app and must not appear in `.env.example` (only empty placeholders and commented examples).

| Variable | Where | Purpose |
|----------|-------|---------|
| `SMTP_HOST` | `.env` | Mail server hostname |
| `SMTP_PORT` | `.env` | Port (commonly `587` for STARTTLS, `465` for SSL) |
| `SMTP_USER` | `.env` | SMTP username |
| `SMTP_PASS` | `.env` | SMTP password |
| `SMTP_FROM` | `.env` | From address shown to recipients |

**Example `.env` block (fake values — replace with your provider):**

```env
SMTP_HOST=smtp.mail.example.com
SMTP_PORT=587
SMTP_USER=paplyn-mailer
SMTP_PASS=your-smtp-password-here
SMTP_FROM=Paplyn <noreply@your-domain.com>
```

### What works without SMTP

Paplyn still runs; outbound email is simply skipped when `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` is missing.

| Feature | Without SMTP |
|---------|----------------|
| **Link-only project invites** | Works — owner creates an invite link in the Share dialog (leave the email field blank) and copies the link manually |
| **Email project invites** | Invite row is created and the link is returned, but **no email is sent**; the UI shows that email is not configured |
| **Password reset emails** | Reset request is accepted but the email is not delivered |
| **Collaboration** | Real-time editing works; sharing is via invite links you copy yourself |

With SMTP configured, entering a collaborator's email in **Share** sends them an invite message automatically.

---

## AI assistant keys

### Self-hosted — environment variables

Set in `.env`:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI-compatible provider (OpenAI, local proxy, etc.) |
| `OPENAI_BASE_URL` | API base (default `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | Model name (default `gpt-4o-mini` for OpenAI) |

Legacy: a `gsk-` key in `XAI_API_KEY` or `OPENAI_API_KEY` is treated as Groq when `GROQ_API_KEY` is unset.

### Self-hosted — Admin UI (alternative)

Organization admins can also set an OpenAI-compatible key, base URL, and model under **Admin → Settings**. Those values are stored in the database and take precedence over `OPENAI_*` env vars for that organization.

### Hosted (SaaS)

Set `GROQ_API_KEY` and/or `OPENAI_API_KEY` in the deployment environment.

---

## Optional — Stripe (SaaS only)

Only when `DEPLOYMENT_MODE=saas`:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STUDENT`, `STRIPE_PRICE_RESEARCHER`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Optional — user reports & Turnstile

The **Report an issue** form (`/report`) is hidden unless **both** a Notion token and database ID are set.

| Variable | Where |
|----------|-------|
| `NOTION_USER_REPORTS_TOKEN` | `.env` (or `NOTION_TOKEN`) |
| `NOTION_USER_REPORTS_DATABASE_ID` | `.env` |
| `TURNSTILE_SECRET_KEY` | `.env` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `.env` |

Honeypot and rate limits still apply when Turnstile is unset.

---

## Per-user keys (not server `.env`)

Each user enters these in [**Settings**](/settings) — they are not deployment secrets:

| Integration | Doc |
|-------------|-----|
| Zotero user ID and API key | [Connect Zotero](/docs/zotero) |
| ORCID account linking (after server OAuth is configured) | [ORCID sign-in](/docs/orcid) |

---

## Checklist before going live

1. `.env` copied — all placeholder secrets replaced with real values
2. `BETTER_AUTH_SECRET` and `COLLAB_SECRET` are unique random strings
3. `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and OAuth redirect URIs all use the same public HTTPS host
4. `NEXT_PUBLIC_COLLAB_URL` uses `wss://` in production
5. PostgreSQL backups configured
6. SMTP, OAuth, AI, Notion, and Stripe vars set only if you need those features

For local development without Docker, see the README **Local development** section.
