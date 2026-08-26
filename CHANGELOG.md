# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Internal npm workspace scope renamed from `@quire` to `@paplyn` (root package `paplyn`, `@paplyn/web`, `@paplyn/collab`, `@paplyn/compiler`). Postgres credentials and production compiler image name unchanged.

### Added

- Mobile project editor layout (viewports under 640px): bottom tabs switch between Files, Editor, and Proof instead of cramped side-by-side columns. Compile stays in the header; PDF and source download remain reachable. Desktop layout modes are unchanged.
- User profile settings at `/settings`: edit display name and change password while signed in.
- Admin user list: instance admins can view registered accounts (email, name, role, join date) with search on `/admin` and `GET /api/admin/users`. Available in SaaS when an instance admin exists; organization settings remain self-hosted only.
- LaTeX editor spellcheck: English misspellings are underlined in prose while LaTeX commands, comments, math, and citation/reference arguments are skipped. Uses a lightweight `nspell` linter with a lazy-loaded dictionary; toggle via the editor toolbar (persisted in local storage).

### Fixed

- SyncTeX reverse lookup: stop subtracting the 72pt Y offset in `findSynctexSource` after click coordinates are already converted to the same absolute page space as TeX Live block geometry, which caused one-section-early jumps on IEEE layouts.
- SyncTeX reverse lookup: convert PDF clicks to SyncTeX's top-left Y-down coordinate system (matching LaTeX-Workshop's `getPagePoint` flip) instead of passing pdf.js bottom-left Y-up coordinates, which collapsed distinct clicks onto the bibliography on IEEE layouts. Nearest-box fallback now fails closed when no block contains the click and the closest match is farther than 72pt.
- Version history timestamps now serialize as UTC ISO strings and display in the viewer's local timezone via `Intl.DateTimeFormat`, instead of showing server-local wall clock times. Revision `created_at` is stored as `timestamptz` going forward.

## [0.1.0] - 2026-08-21

Initial release. Merged work through PR #29.

### Added

- Collaborative LaTeX web app: multi-file editor, project dashboard, auth, and admin settings
- Real-time collaboration with Yjs (CodeMirror binding, presence, Postgres room persistence)
- LaTeX compile service with pdfLaTeX, XeLaTeX, and LuaLaTeX; BibTeX and Biber bibliography passes
- SyncTeX: compile with `-synctex=1` and PDF click-to-source navigation
- PDF preview with compile log and error navigation
- Project file tree: folders, rename/move, image and PDF preview, source zip download
- Overleaf-style zip project import
- Project templates: blank article, IEEE conference, thesis chapter, Beamer slides
- LaTeX editor autocomplete, search/replace, go-to-line, and word count
- Project sharing via email invites with owner/editor/viewer roles
- Project version history with restore and retention
- Project settings, duplicate, and dashboard delete/archive
- Optional OpenAI-compatible AI assistant sidebar
- Light, dark, and system themes; configurable workspace layout modes
- Plicum branding, wordmarks, and favicon
- Dual deployment modes: SaaS (Stripe billing, plan limits) and self-hosted (single org, no billing)
- Docker Compose stack: web, compiler, collab, and PostgreSQL
- Production Compose overlay binding services to localhost
- Automatic database migrations on web container startup

### Changed

- Renamed public product from Quire to Plicum; centralized branding in `product.ts`
- Upgraded web Docker image to Node 22
- Pinned compiler image to TeX Live 2026 base image

### Fixed

- Better Auth signup (`account.issuer` schema)
- Self-host auth and collab WebSocket URLs on public domains without image rebuild
- Next.js static assets path in web Docker image
- Docker production deploy: pnpm store, web CMD, localhost port bindings
- Silent compile failures; TeX Live installation in compiler image
- Docker build and PostgreSQL 16 boot migrations
- SyncTeX reverse lookup Y coordinate mapping
- Deploy build after SyncTeX integration

[Unreleased]: https://github.com/amine0110/plicum/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/amine0110/plicum/releases/tag/v0.1.0
