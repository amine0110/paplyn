import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "student", "researcher"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "editor", "viewer"]);
export const inviteRoleEnum = pgEnum("invite_role", ["editor", "viewer"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  plan: planEnum("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("account_issuer_account_id_idx").on(table.issuer, table.accountId)]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  openaiApiKey: text("openai_api_key"),
  openaiBaseUrl: text("openai_base_url"),
  openaiModel: text("openai_model"),
  compileTimeoutMs: integer("compile_timeout_ms").default(60000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  mainFile: text("main_file").notNull().default("main.tex"),
  compiler: text("compiler").notNull().default("pdflatex"),
  template: text("template"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectFile = pgTable(
  "project_file",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull().default(""),
    isBinary: boolean("is_binary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("project_file_path_idx").on(table.projectId, table.path)]
);

export const projectMember = pgTable(
  "project_member",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("editor"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("project_member_idx").on(table.projectId, table.userId)]
);

export const projectInvite = pgTable("project_invite", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  email: text("email"),
  role: inviteRoleEnum("role").notNull().default("editor"),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => user.id),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compileLog = pgTable("compile_log", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  success: boolean("success").notNull(),
  durationMs: integer("duration_ms"),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageCounter = pgTable(
  "usage_counter",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    compiles: integer("compiles").notNull().default(0),
    aiRequests: integer("ai_requests").notNull().default(0),
  },
  (table) => [uniqueIndex("usage_user_month_idx").on(table.userId, table.month)]
);

/** Live Yjs CRDT state for a collab room (project id). Distinct from project_file HTTP saves. */
export const collabRoom = pgTable("collab_room", {
  roomId: text("room_id").primaryKey(),
  state: text("state").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Point-in-time snapshot of project files (and optional compiled PDF). */
export const projectRevision = pgTable("project_revision", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  label: text("label"),
  source: text("source").notNull().default("compile"),
  mainFile: text("main_file").notNull(),
  compiler: text("compiler").notNull(),
  files: jsonb("files").notNull(),
  pdf: text("pdf"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type Project = typeof project.$inferSelect;
export type ProjectFile = typeof projectFile.$inferSelect;
export type ProjectMember = typeof projectMember.$inferSelect;
export type CollabRoom = typeof collabRoom.$inferSelect;
export type ProjectRevision = typeof projectRevision.$inferSelect;
