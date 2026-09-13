export const THEME_KEY = "vocaknio_theme_mode_v3";
export const LEGACY_THEME_KEY = "vocaknio_theme_mode_v2";
export const THEME_MODES = ["light", "paper", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "paper" || value === "dark";
}

/** v3 is JSON; the unmodified v2 raw string remains a migration backup. */
export function resolveThemePreference(current: string | null, legacy: string | null): ThemeMode {
  if (current !== null) {
    const parsed: unknown = JSON.parse(current);
    if (!isThemeMode(parsed)) throw new Error("Unreadable theme preference");
    return parsed;
  }
  return legacy === "dark" ? "dark" : legacy === "light" ? "paper" : "light";
}
