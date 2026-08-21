-- Allow link-only invites without an email address
ALTER TABLE project_invite ALTER COLUMN email DROP NOT NULL;
