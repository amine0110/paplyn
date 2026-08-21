CREATE TABLE IF NOT EXISTS project_revision (
  id text PRIMARY KEY NOT NULL,
  project_id text NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id),
  label text,
  source text DEFAULT 'compile' NOT NULL,
  main_file text NOT NULL,
  compiler text NOT NULL,
  files jsonb NOT NULL,
  pdf text,
  created_at timestamp DEFAULT now() NOT NULL
);
