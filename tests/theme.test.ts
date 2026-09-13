import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import themeConfig from "../theme.config";
import { LEGACY_THEME_KEY, THEME_KEY, THEME_MODES, resolveThemePreference } from "../lib/theme-preference";
import { getThemeBootstrapScript } from "../lib/web-theme";
import { getTabMetrics, SCROLL_END_PADDING, WEB_CONTENT_MAX_WIDTH } from "../lib/layout";

describe("three-theme contract", () => {
  it("preserves Paper and Dark while making new Light neutral white", () => {
    expect(themeConfig.themeColors.background).toEqual({ light: "#F8FAFC", paper: "#F5F0E6", dark: "#07080f" });
    for (const swatch of Object.values(themeConfig.themeColors)) {
      for (const mode of THEME_MODES) expect(swatch[mode]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    [null, null, "light"], [null, "light", "paper"], [null, "dark", "dark"],
    ['"light"', "light", "light"], ['"paper"', "dark", "paper"], ['"dark"', "light", "dark"],
  ])("resolves %s / %s to %s before first paint", (current, legacy, expected) => {
    expect(resolveThemePreference(current, legacy)).toBe(expected);
    const tokens: Record<string, string> = {};
    const meta: Record<string, string> = {};
    const classes = new Set<string>();
    const root = { dataset: {} as Record<string, string>, style: {
      colorScheme: "", backgroundColor: "",
      setProperty: (key: string, value: string) => { tokens[key] = value; },
    }, classList: { toggle: (key: string, enabled: boolean) => { if (enabled) classes.add(key); else classes.delete(key); } } };
    const document = { documentElement: root, querySelector: (key: string) => ({ setAttribute: (_attr: string, value: string) => { meta[key] = value; } }) };
    runInNewContext(getThemeBootstrapScript(), { document, localStorage: { getItem: (key: string) => key === THEME_KEY ? current : key === LEGACY_THEME_KEY ? legacy : null } });
    const palette = themeConfig.themeColors;
    expect(root.dataset.theme).toBe(expected);
    expect(root.style.backgroundColor).toBe(palette.background[expected as keyof typeof palette.background]);
    expect(tokens["--color-background"]).toBe(root.style.backgroundColor);
    expect(root.style.colorScheme).toBe(expected === "dark" ? "dark" : "only light");
    expect(classes.has("dark")).toBe(expected === "dark");
    expect(meta['meta[name="theme-color"]']).toBe(root.style.backgroundColor);
  });

  it("does not silently accept corrupt v3 bytes", () => {
    for (const raw of ["light", '"system"', "{}", "null"]) expect(() => resolveThemePreference(raw, "light")).toThrow();
  });

  it("compacts web only and retains native safe-area math", () => {
    expect(getTabMetrics(true, 34)).toMatchObject({ height: 52, iconSize: 21, minTouchHeight: 44 });
    expect(getTabMetrics(false, 34)).toMatchObject({ height: 90, paddingBottom: 34, minTouchHeight: 48 });
    expect(getTabMetrics(false, 0)).toMatchObject({ height: 64, paddingBottom: 8 });
    expect(SCROLL_END_PADDING).toBeGreaterThanOrEqual(44);
    expect(SCROLL_END_PADDING).toBeLessThanOrEqual(56);
    expect(WEB_CONTENT_MAX_WIDTH).toBe(880);
  });
});
