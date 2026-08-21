-- Store revision timestamps as UTC instants (timestamptz).
-- Legacy rows used timestamp without time zone; interpret naive values as UTC.
ALTER TABLE project_revision
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
