# Security Policy

## Reporting a vulnerability

If you discover a security issue in Paplyn, please report it privately. **Do not** open a public GitHub issue for vulnerabilities, exposed credentials, or suspected data leaks.

You can report issues in either of these ways:

1. **GitHub private security advisory** — Open a [private vulnerability report](https://github.com/amine0110/paplyn/security/advisories/new) on this repository (preferred once the repo is public).
2. **Email** — Contact the maintainers through the email listed on the repository profile or your existing Paplyn support channel.

Include a clear description, steps to reproduce, and the impact if known. We will acknowledge receipt and work on a fix as quickly as we can.

## What not to do

- Do not commit secrets, API keys, or `.env` files.
- Do not post credentials or personal data in public issues or pull requests.
- Do not test against production systems without permission.

## Supported versions

Security fixes are applied to the `main` branch and released as part of normal development. Self-hosters should pull the latest `main` or tagged release after a security fix is published.
