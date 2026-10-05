import fs from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiCall, exchangeOAuthCode } from "@/lib/_core/api";
import * as auth from "@/lib/_core/auth";

const memory = vi.hoisted(() => new Map<string, string>());
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({ getItemAsync: async (key: string) => memory.get(key) ?? null, setItemAsync: async (key: string, value: string) => { memory.set(key, value); }, deleteItemAsync: async (key: string) => { memory.delete(key); } }));
vi.mock("@/constants/oauth", () => ({ getApiBaseUrl: () => "https://example.invalid", SESSION_TOKEN_KEY: "existing-session-key", USER_INFO_KEY: "existing-user-key" }));
beforeEach(() => { memory.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("keeps native secure storage and Bearer transport without token or user diagnostics", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const token = "synthetic-session-value";
  const user = { id: 1, name: "synthetic user", email: "fixture@example.invalid", loginMethod: "test" };
  await auth.setSessionToken(token); await auth.setUserInfo(user);
  expect(await auth.getSessionToken()).toBe(token); expect(await auth.getUserInfo()).toEqual(user);
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ app_session_id: token, user }), { headers: { "content-type": "application/json", "set-cookie": "synthetic-cookie" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await exchangeOAuthCode("synthetic-code", "synthetic-state")).toEqual({ sessionToken: token, user });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
  expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  await auth.removeSessionToken(); expect(await auth.getSessionToken()).toBeNull();
});
it("does not display backend stack traces or query values as error text", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fixture backend stack trace", { status: 500 })));
  await expect(apiCall("/api/test")).rejects.toThrow("HTTP 500");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fixture private URL")));
  await expect(apiCall("/api/test")).rejects.toThrow("서버에 연결하지 못했습니다");
});
it("keeps console logging out of auth/URL/user callback paths", () => {
  for (const file of ["lib/_core/api.ts", "lib/_core/auth.ts", "app/oauth/callback.tsx"]) expect(fs.readFileSync(file, "utf8")).not.toMatch(/console\.(?:log|error|warn)\(/);
});
