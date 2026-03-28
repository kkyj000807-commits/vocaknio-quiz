/**
 * 자체 인증 시스템 — Manus OAuth 없이 독립 실행
 * - 이메일 + 비밀번호 회원가입/로그인
 * - 구글 OAuth 로그인
 * - JWT 세션 토큰 발급
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";

const JWT_SECRET = process.env.JWT_SECRET || "vocaknio-quiz-secret-2026";
const JWT_EXPIRES = "30d";

export type SessionUser = {
  id: number;
  email: string | null;
  name: string | null;
  loginMethod: string | null;
};

/** JWT 발급 */
export function signToken(user: SessionUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, loginMethod: user.loginMethod },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/** JWT 검증 */
export function verifyToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionUser & { iat: number; exp: number };
    return { id: payload.id, email: payload.email, name: payload.name, loginMethod: payload.loginMethod };
  } catch {
    return null;
  }
}

/** 이메일/비밀번호 회원가입 */
export async function registerWithEmail(
  email: string,
  password: string,
  name: string
): Promise<{ token: string; user: SessionUser } | { error: string }> {
  const db = await getDb();
  if (!db) return { error: "데이터베이스 연결 오류" };

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { error: "이미 사용 중인 이메일입니다." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await db.insert(users).values({
    email,
    passwordHash,
    name,
    loginMethod: "email",
    openId: null,
  });

  const userId = (result as any).insertId as number;
  const user: SessionUser = { id: userId, email, name, loginMethod: "email" };
  return { token: signToken(user), user };
}

/** 이메일/비밀번호 로그인 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ token: string; user: SessionUser } | { error: string }> {
  const db = await getDb();
  if (!db) return { error: "데이터베이스 연결 오류" };

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !user.passwordHash) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  const sessionUser: SessionUser = { id: user.id, email: user.email, name: user.name, loginMethod: "email" };
  return { token: signToken(sessionUser), user: sessionUser };
}

/** 구글 OAuth 콜백 처리 */
export async function loginWithGoogle(
  googleId: string,
  email: string,
  name: string
): Promise<{ token: string; user: SessionUser }> {
  const db = await getDb();
  if (!db) throw new Error("데이터베이스 연결 오류");

  // 구글 ID로 기존 사용자 찾기
  let rows = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

  if (rows.length === 0 && email) {
    // 같은 이메일로 가입된 계정이 있으면 구글 ID 연결
    rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (rows.length > 0) {
      await db.update(users)
        .set({ googleId, loginMethod: "google", lastSignedIn: new Date() })
        .where(eq(users.id, rows[0].id));
    }
  }

  if (rows.length === 0) {
    // 신규 사용자 생성
    const [result] = await db.insert(users).values({
      googleId,
      email: email || null,
      name,
      loginMethod: "google",
      openId: null,
    });
    const userId = (result as any).insertId as number;
    const user: SessionUser = { id: userId, email, name, loginMethod: "google" };
    return { token: signToken(user), user };
  }

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, rows[0].id));
  const u = rows[0];
  const sessionUser: SessionUser = { id: u.id, email: u.email, name: u.name ?? name, loginMethod: "google" };
  return { token: signToken(sessionUser), user: sessionUser };
}

/** 요청에서 세션 사용자 추출 (Bearer 토큰 또는 쿠키) */
export function extractUserFromRequest(req: any): SessionUser | null {
  const authHeader = req.headers?.authorization as string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }
  const cookieHeader = req.headers?.cookie as string | undefined;
  if (cookieHeader) {
    const match = cookieHeader.match(/app_session_id=([^;]+)/);
    if (match) {
      return verifyToken(decodeURIComponent(match[1]));
    }
  }
  return null;
}
