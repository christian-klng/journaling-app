ALTER TABLE "users" ADD COLUMN "code_stem" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "study_group_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_study_group_id_study_groups_id_fk" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_code_stem_idx" ON "users" USING btree ("code_stem");