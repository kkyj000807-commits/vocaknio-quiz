import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, userData, InsertUserData } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── User Data (오답·북마크·통계) ────────────────────────────────────────────

export async function getUserData(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userData).where(eq(userData.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserData(userId: number, data: Partial<Omit<InsertUserData, "id" | "userId" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserData(userId);
  if (!existing) {
    await db.insert(userData).values({
      userId,
      wrongNums: data.wrongNums ?? "[]",
      bookmarkNums: data.bookmarkNums ?? "[]",
      totalAnswered: data.totalAnswered ?? 0,
      totalCorrect: data.totalCorrect ?? 0,
      streakDays: data.streakDays ?? 0,
      lastStudiedAt: data.lastStudiedAt ?? "",
    });
  } else {
    const updateSet: Record<string, unknown> = {};
    if (data.wrongNums !== undefined) updateSet.wrongNums = data.wrongNums;
    if (data.bookmarkNums !== undefined) updateSet.bookmarkNums = data.bookmarkNums;
    if (data.totalAnswered !== undefined) updateSet.totalAnswered = data.totalAnswered;
    if (data.totalCorrect !== undefined) updateSet.totalCorrect = data.totalCorrect;
    if (data.streakDays !== undefined) updateSet.streakDays = data.streakDays;
    if (data.lastStudiedAt !== undefined) updateSet.lastStudiedAt = data.lastStudiedAt;
    if (Object.keys(updateSet).length > 0) {
      await db.update(userData).set(updateSet).where(eq(userData.userId, userId));
    }
  }
}
