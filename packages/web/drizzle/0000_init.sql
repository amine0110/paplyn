-- Plicum database schema (generated for initial setup)
-- Run via: pnpm db:push (recommended) or apply manually
--
-- PostgreSQL 16 rejects IF NOT EXISTS on enum CREATE TYPE. Use duplicate_object
-- guards so enum creation stays idempotent without drizzle-kit push.

DO $$ BEGIN
  CREATE TYPE plan AS ENUM ('free', 'student', 'researcher');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invite_role AS ENUM ('editor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- better-auth 1.2+ requires account.issuer (stable provider-side account key)
ALTER TABLE account ADD COLUMN IF NOT EXISTS issuer text;
UPDATE account SET issuer = 'local:credential' WHERE issuer IS NULL AND provider_id = 'credential';
ALTER TABLE account ALTER COLUMN issuer SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_account_id_idx ON account (issuer, account_id);
