CREATE TABLE "leads" (
	"id" serial PRIMARY KEY,
	"kind" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"fields" jsonb DEFAULT '{}' NOT NULL,
	"extra" jsonb DEFAULT '{}' NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"ghl_delivered" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" ("created_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" ("status");