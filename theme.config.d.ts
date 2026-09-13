export type ThemeSwatch = Record<"light" | "paper" | "dark", string>;
export const themeColors: Record<
  "primary" | "primary2" | "background" | "surface" | "card" |
  "foreground" | "muted" | "dim" | "border" | "success" |
  "warning" | "error" | "tint", ThemeSwatch
>;
declare const themeConfig: { themeColors: typeof themeColors };
export default themeConfig;
