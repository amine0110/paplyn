CREATE TABLE IF NOT EXISTS collab_room (
  room_id text PRIMARY KEY NOT NULL,
  state text NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
