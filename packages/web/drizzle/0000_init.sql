-- Plicum database schema (generated for initial setup)
-- Run via: pnpm db:push (recommended) or apply manually

CREATE TYPE IF NOT EXISTS plan AS ENUM ('free', 'student', 'researcher');
CREATE TYPE IF NOT EXISTS member_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE IF NOT EXISTS invite_role AS ENUM ('editor', 'viewer');

-- better-auth 1.2+ requires account.issuer (stable provider-side account key)
ALTER TABLE account ADD COLUMN IF NOT EXISTS issuer text;
UPDATE account SET issuer = 'local:credential' WHERE issuer IS NULL AND provider_id = 'credential';
ALTER TABLE account ALTER COLUMN issuer SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_account_id_idx ON account (issuer, account_id);
