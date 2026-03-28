import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table — supports email/password + Google OAuth login.
 * openId is kept for backward compat but nullable for new self-auth users.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 256 }),   // null for social-only accounts
  googleId: varchar("googleId", { length: 128 }).unique(),  // null for email-only accounts
  loginMethod: varchar("loginMethod", { length: 64 }),      // "email" | "google" | "apple"
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 사용자별 학습 데이터 동기화 테이블
 */
export const userData = mysqlTable("user_data", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  wrongNums: text("wrongNums").notNull(),
  bookmarkNums: text("bookmarkNums").notNull(),
  totalAnswered: int("totalAnswered").default(0).notNull(),
  totalCorrect: int("totalCorrect").default(0).notNull(),
  streakDays: int("streakDays").default(0).notNull(),
  lastStudiedAt: varchar("lastStudiedAt", { length: 10 }).default("").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserData = typeof userData.$inferSelect;
export type InsertUserData = typeof userData.$inferInsert;
