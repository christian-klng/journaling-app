DROP INDEX IF EXISTS "users_team_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "team_id";--> statement-breakpoint
DROP TABLE IF EXISTS "teams";
