import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const summaryStatusEnum = pgEnum("summary_status", ["pending", "done", "failed"]);
export const recordingStatusEnum = pgEnum("recording_status", [
  "uploaded",
  "transcribing",
  "done",
  "failed",
]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nur für den Login. Wird Admins nie angezeigt und nie exportiert.
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull().unique(),
    role: roleEnum("role").notNull().default("user"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    tempPasswordExpiresAt: timestamp("temp_password_expires_at", { withTimezone: true }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_team_idx").on(t.teamId)],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 des Cookie-Tokens, das Token selbst wird nicht gespeichert
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summary: jsonb("summary").$type<string[]>(),
    summaryStatus: summaryStatusEnum("summary_status").notNull().default("pending"),
    // Anzahl der Aufnahmen, die in der gespeicherten Zusammenfassung berücksichtigt sind
    summaryRecordingCount: integer("summary_recording_count").notNull().default(0),
    summaryAttempts: integer("summary_attempts").notNull().default(0),
    summaryError: text("summary_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entries_user_idx").on(t.userId, t.createdAt)],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    storageKeyOriginal: text("storage_key_original").notNull(),
    storageKeyMp3: text("storage_key_mp3"),
    mimeType: text("mime_type").notNull(),
    durationSeconds: integer("duration_seconds"),
    sizeBytes: integer("size_bytes").notNull(),
    status: recordingStatusEnum("status").notNull().default("uploaded"),
    transcript: text("transcript"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recordings_entry_position_idx").on(t.entryId, t.position)],
);

/** Von Admins in der App gepflegte Einstellungen, z. B. der Hinweistext für die Transkription. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({ users: many(users) }));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  user: one(users, { fields: [entries.userId], references: [users.id] }),
  recordings: many(recordings),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  entry: one(entries, { fields: [recordings.entryId], references: [entries.id] }),
}));

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
