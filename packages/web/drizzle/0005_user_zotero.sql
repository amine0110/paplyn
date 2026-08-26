ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "zotero_user_id" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "zotero_api_key" text;
