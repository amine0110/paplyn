# Contributing

Thanks for helping improve Paplyn.

## Development setup

1. **Prerequisites:** Node.js 22+, pnpm 9+, PostgreSQL 16+ (or Docker for Postgres only).
2. **Clone and install:**
   ```bash
   git clone https://github.com/amine0110/paplyn.git
   cd paplyn
   cp .env.example .env
   pnpm install
   ```
3. **Database:** Start PostgreSQL and run `pnpm db:push`, or use `docker compose up postgres -d`.
4. **Services:** Run the compiler, collab, and web packages in separate terminals (see [README.md](README.md#local-development)), or use `docker compose up` for the full stack.

## Running tests

```bash
pnpm test
```

Run tests before opening a pull request. Add or update tests when changing behavior in `packages/web`, `packages/collab`, or `packages/compiler`.

## Pull requests

- Branch from `main`.
- Keep changes focused — one logical change per PR when possible.
- Do not commit secrets, `.env` files, or deployment credentials. See [SECURITY.md](SECURITY.md) for how to report vulnerabilities privately.
- Update [CHANGELOG.md](CHANGELOG.md) under `[Unreleased]` for user-visible changes.
- Ensure `pnpm test` passes.

Describe what changed, why, and how you verified it. Link related issues if applicable.

## Code conventions

- Match existing patterns in the package you are editing.
- Product-facing strings belong in [`packages/web/src/lib/product.ts`](packages/web/src/lib/product.ts).
- Internal npm scope is `@paplyn`; public name is Paplyn.

## Questions

Open a GitHub issue for bugs, feature requests, or setup problems.
