-- Quire database schema (generated for initial setup)
-- Run via: pnpm db:push (recommended) or apply manually

CREATE TYPE IF NOT EXISTS plan AS ENUM ('free', 'student', 'researcher');
CREATE TYPE IF NOT EXISTS member_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE IF NOT EXISTS invite_role AS ENUM ('editor', 'viewer');
