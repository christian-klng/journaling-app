CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_text" text NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "questionnaire_id" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "week_start" date;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "study_group_id" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "item_text" text;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_item_id_questionnaire_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."questionnaire_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answers_entry_item_idx" ON "answers" USING btree ("entry_id","item_id");--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_questionnaire_id_questionnaires_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."questionnaires"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_study_group_id_study_groups_id_fk" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_item_id_questionnaire_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."questionnaire_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_user_questionnaire_week_idx" ON "entries" USING btree ("user_id","questionnaire_id","week_start") WHERE "entries"."questionnaire_id" is not null;