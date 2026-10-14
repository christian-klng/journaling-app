import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  smallint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const itemTypeEnum = pgEnum("item_type", ["smiley", "scale", "audio"]);
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
    passwordHash: text("password_hash").notNull(),
    // Der Fantasiename ist zugleich der Benutzername. Eine E-Mail-Adresse speichern wir nicht.
    displayName: text("display_name").notNull().unique(),
    // Fantasiename in Kleinbuchstaben und ohne Umlaute, damit die Anmeldung Tippvarianten verzeiht
    loginName: text("login_name").notNull().unique(),
    role: roleEnum("role").notNull().default("user"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    // Persönlicher Code ohne Gruppenbuchstaben, z. B. "KA-03-BE". Nur bei Teilnehmenden.
    codeStem: text("code_stem"),
    // Setzen Teilnehmende einmal selbst, danach ändern ihn nur Admins
    studyGroupId: uuid("study_group_id").references(() => studyGroups.id, { onDelete: "restrict" }),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    tempPasswordExpiresAt: timestamp("temp_password_expires_at", { withTimezone: true }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_team_idx").on(t.teamId), index("users_code_stem_idx").on(t.codeStem)],
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
    // Abfrage und Woche (Montag), zu der der Eintrag gehört. Leer bei freien Einträgen aus der
    // Zeit vor den Abfragen.
    questionnaireId: uuid("questionnaire_id").references(() => questionnaires.id, { onDelete: "restrict" }),
    weekStart: date("week_start"),
    // Gruppe beim Ausfüllen, damit ein späterer Gruppenwechsel alte Einträge nicht umschreibt
    studyGroupId: uuid("study_group_id").references(() => studyGroups.id, { onDelete: "restrict" }),
    // Nach dem Ende des Zeitfensters begonnen
    late: boolean("late").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entries_user_idx").on(t.userId, t.createdAt),
    // Pro Person, Abfrage und Woche gibt es genau einen Eintrag
    uniqueIndex("entries_user_questionnaire_week_idx")
      .on(t.userId, t.questionnaireId, t.weekStart)
      .where(sql`${t.questionnaireId} is not null`),
  ],
);

/** Antworten auf Skalen. Audio-Antworten sind Aufnahmen und stehen in recordings. */
export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => questionnaireItems.id, { onDelete: "restrict" }),
    // Typ und Text so, wie die Person sie gesehen hat
    itemType: itemTypeEnum("item_type").notNull(),
    itemText: text("item_text").notNull(),
    value: smallint("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("answers_entry_item_idx").on(t.entryId, t.itemId)],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    // Audio-Frage, auf die die Aufnahme antwortet, mit dem Text, den die Person gesehen hat
    itemId: uuid("item_id").references(() => questionnaireItems.id, { onDelete: "restrict" }),
    itemText: text("item_text"),
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

// Studienablauf: Gruppen mit ihren Abfragen (z. B. Check-In und Check-Out). Alles wird im
// Admin-Bereich gepflegt und steht bewusst nicht im Code, damit das öffentliche Repository die
// Fragen der Gruppen nicht verrät.

export const studyGroups = pgTable("study_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Teil des persönlichen Codes, z. B. "A"
  letter: text("letter").notNull().unique(),
  // Nur für Admins sichtbar, z. B. "Guided Reflection"
  label: text("label").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionnaires = pgTable(
  "questionnaires",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => studyGroups.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    intro: text("intro").notNull().default(""),
    // Zeitfenster innerhalb einer Woche, 1 = Montag … 7 = Sonntag
    opensOn: smallint("opens_on").notNull(),
    closesOn: smallint("closes_on").notNull(),
    position: integer("position").notNull(),
    // Archiviert statt gelöscht, damit gegebene Antworten ihre Abfrage behalten
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questionnaires_group_idx").on(t.groupId, t.position)],
);

export const questionnaireItems = pgTable(
  "questionnaire_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionnaireId: uuid("questionnaire_id")
      .notNull()
      .references(() => questionnaires.id, { onDelete: "cascade" }),
    // Lässt sich nach dem Anlegen nicht mehr ändern, sonst passten alte Antworten nicht mehr
    type: itemTypeEnum("type").notNull(),
    text: text("text").notNull(),
    required: boolean("required").notNull().default(true),
    // Beschriftung der Enden, nur bei der Skala 0–10
    minLabel: text("min_label").notNull().default(""),
    maxLabel: text("max_label").notNull().default(""),
    position: integer("position").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questionnaire_items_questionnaire_idx").on(t.questionnaireId, t.position)],
);

export const teamsRelations = relations(teams, ({ many }) => ({ users: many(users) }));

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  studyGroup: one(studyGroups, { fields: [users.studyGroupId], references: [studyGroups.id] }),
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  user: one(users, { fields: [entries.userId], references: [users.id] }),
  questionnaire: one(questionnaires, { fields: [entries.questionnaireId], references: [questionnaires.id] }),
  studyGroup: one(studyGroups, { fields: [entries.studyGroupId], references: [studyGroups.id] }),
  recordings: many(recordings),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  entry: one(entries, { fields: [answers.entryId], references: [entries.id] }),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  entry: one(entries, { fields: [recordings.entryId], references: [entries.id] }),
}));

export const studyGroupsRelations = relations(studyGroups, ({ many }) => ({
  questionnaires: many(questionnaires),
}));

export const questionnairesRelations = relations(questionnaires, ({ one, many }) => ({
  group: one(studyGroups, { fields: [questionnaires.groupId], references: [studyGroups.id] }),
  items: many(questionnaireItems),
}));

export const questionnaireItemsRelations = relations(questionnaireItems, ({ one }) => ({
  questionnaire: one(questionnaires, {
    fields: [questionnaireItems.questionnaireId],
    references: [questionnaires.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Recording = typeof recordings.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type StudyGroup = typeof studyGroups.$inferSelect;
export type Questionnaire = typeof questionnaires.$inferSelect;
export type QuestionnaireItem = typeof questionnaireItems.$inferSelect;
export type ItemType = (typeof itemTypeEnum.enumValues)[number];
