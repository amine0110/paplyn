# ORCID sign-in

Paplyn supports **ORCID Public API** sign-in (not Member API). Researchers can use their ORCID iD on `/login` and `/signup` when `ORCID_CLIENT_ID` and `ORCID_CLIENT_SECRET` are configured.

## Register a Public API client

1. Sign in at [orcid.org](https://orcid.org) and open **Developer tools** (under your account name).
2. Click **Register for the free ORCID Public API** (or create a new application if you already have one).
3. Set **Application name** (e.g. `Paplyn`) and **Application URL** to your Paplyn base URL (e.g. `https://paplyn.com`).
4. Add this **Redirect URI** exactly (replace the host with your deployment):

```
https://<your-paplyn-host>/api/auth/callback/orcid
```

Better Auth `^1.2.3` (installed in Paplyn) registers generic OAuth providers on **`/api/auth/callback/:providerId`**. With `providerId` `orcid`, the callback path is:

```
/api/auth/callback/orcid
```

(Newer Better Auth releases may use `/api/auth/oauth2/callback/:providerId` instead — Paplyn pins `^1.2.3`, so use the path above.)

5. Copy the **Client ID** and **Client secret** into your environment (see below). Do not commit secrets to the repository.

## Environment variables

Set both variables on the web service (runtime env, not Docker build args):

| Variable | Description |
| --- | --- |
| `ORCID_CLIENT_ID` | ORCID Public API client ID |
| `ORCID_CLIENT_SECRET` | ORCID Public API client secret |

When either is missing, the ORCID button stays hidden (same pattern as Google/GitHub).

Example (`.env` on the host):

```env
ORCID_CLIENT_ID=APP-XXXXXXXXXXXXXXXX
ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## How sign-in works

- Paplyn uses Better Auth `genericOAuth` with ORCID OpenID discovery: `https://orcid.org/.well-known/openid-configuration`.
- Requested scopes: `openid` and `/read-public` (read public record data, including a **public primary email**).
- PKCE is **disabled** — ORCID Public API does not support PKCE on the token endpoint.
- Identity uses the provider's **primary email only** when it is **public** on the ORCID record. If ORCID does not return a public primary email, sign-in fails with an in-app message asking the user to make their primary email public at orcid.org or to use Google/GitHub instead. Paplyn never invents a placeholder email.
- If that email already exists (password, Google, or GitHub), the user is signed into that account. Otherwise a new user is created.
- The authenticated ORCID iD is stored as the provider account id (`providerAccountId`), same as other social providers.

## User experience

- Use the official green ORCID **iD** mark on the button (see [ORCID brand guidelines](https://info.orcid.org/brand-guidelines/)).
- ORCID is an **authentication** option only — it is not shown in the landing-page integrations marquee.

## Sandbox testing

For sandbox, register a client at [sandbox.orcid.org](https://sandbox.orcid.org) and point discovery/API URLs to sandbox if you maintain a separate sandbox build. Production Paplyn uses `orcid.org` endpoints.
