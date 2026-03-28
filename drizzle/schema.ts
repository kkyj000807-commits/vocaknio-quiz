import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 사용자별 학습 데이터 동기화 테이블
 * - wrongNums: 오답 단어 번호 목록 (JSON 배열 문자열)
 * - bookmarkNums: 북마크 단어 번호 목록 (JSON 배열 문자열)
 * - totalAnswered: 전체 풀이 수
 * - totalCorrect: 전체 정답 수
 * - streakDays: 연속 학습일
 * - lastStudiedAt: 마지막 학습 날짜
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
