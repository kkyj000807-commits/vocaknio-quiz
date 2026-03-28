/**
 * 자체 인증 라우트 — Manus OAuth 없이 독립 실행
 * - POST /api/auth/register  : 이메일+비밀번호 회원가입
 * - POST /api/auth/login     : 이메일+비밀번호 로그인
 * - POST /api/auth/google    : 구글 ID 토큰으로 로그인/회원가입
 * - POST /api/auth/logout    : 로그아웃 (쿠키 삭제)
 * - GET  /api/auth/me        : 현재 로그인 사용자 정보
 * - POST /api/auth/session   : Bearer 토큰 → 쿠키 교환 (웹 iframe용)
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "./cookies";
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  extractUserFromRequest,
  signToken,
} from "../auth";

export function registerOAuthRoutes(app: Express) {
  // ── 이메일 회원가입 ──────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!email || !password || !name) {
      res.status(400).json({ error: "이메일, 비밀번호, 이름을 모두 입력해 주세요." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "비밀번호는 6자 이상이어야 합니다." });
      return;
    }
    const result = await registerWithEmail(email.trim().toLowerCase(), password, name.trim());
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, result.token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ token: result.token, user: result.user });
  });

  // ── 이메일 로그인 ────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "이메일과 비밀번호를 입력해 주세요." });
      return;
    }
    const result = await loginWithEmail(email.trim().toLowerCase(), password);
    if ("error" in result) {
      res.status(401).json({ error: result.error });
      return;
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, result.token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ token: result.token, user: result.user });
  });

  // ── 구글 로그인 (클라이언트에서 id_token 전달) ───────────────────
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    const { googleId, email, name } = req.body as {
      googleId?: string;
      email?: string;
      name?: string;
    };
    if (!googleId) {
      res.status(400).json({ error: "googleId가 필요합니다." });
      return;
    }
    try {
      const result = await loginWithGoogle(googleId, email || "", name || "Google 사용자");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ token: result.token, user: result.user });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "구글 로그인 실패" });
    }
  });

  // ── 로그아웃 ─────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // ── 현재 사용자 정보 ─────────────────────────────────────────────
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const user = extractUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated", user: null });
      return;
    }
    res.json({ user });
  });

  // ── Bearer 토큰 → 쿠키 교환 (웹 iframe 미리보기용) ───────────────
  app.post("/api/auth/session", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      res.status(400).json({ error: "Bearer token required" });
      return;
    }
    const token = authHeader.slice(7).trim();
    const user = extractUserFromRequest({ headers: { authorization: authHeader } });
    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ success: true, user });
  });

  // ── 구 Manus OAuth 콜백 — 하위 호환 (사용 안 함) ─────────────────
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, process.env.EXPO_WEB_PREVIEW_URL || "http://localhost:8081");
  });
  app.get("/api/oauth/mobile", (_req: Request, res: Response) => {
    res.status(410).json({ error: "Manus OAuth is no longer used." });
  });
}
