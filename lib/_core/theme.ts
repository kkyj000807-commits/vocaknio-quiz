import { Platform } from "react-native";

import themeConfig from "@/theme.config";

export type ColorScheme = "light" | "dark";

/** 앱 테마 모드 — 설정에서 선택, 기본값 paper_blue */
export type AppThemeName = "dark_navy" | "clean_sky" | "paper_blue" | "exam_paper";

export const APP_THEME_META: Record<
  AppThemeName,
  { label: string; desc: string; recommended?: boolean }
> = {
  dark_navy:  { label: "기존 다크",   desc: "어두운 환경용" },
  clean_sky:  { label: "클린 스카이", desc: "밝고 깔끔한 화면" },
  paper_blue: { label: "페이퍼 블루", desc: "장시간 학습 추천", recommended: true },
  exam_paper: { label: "시험지 모드", desc: "기출 원문·해설 읽기 추천" },
};

export const DEFAULT_APP_THEME: AppThemeName = "paper_blue";

/** 테마 → 이진 스킴 (상태바·nativewind 클래스용) */
export function schemeOfTheme(name: AppThemeName): ColorScheme {
  return name === "dark_navy" ? "dark" : "light";
}

export const ThemeColors = themeConfig.themeColors;

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

type RuntimePalette = SchemePaletteItem & {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
};

function buildRuntimePalette(scheme: ColorScheme): RuntimePalette {
  const base = SchemeColors[scheme];
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: base.tint ?? base.primary,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
  };
}

export const Colors = {
  light: buildRuntimePalette("light"),
  dark: buildRuntimePalette("dark"),
} satisfies Record<ColorScheme, RuntimePalette>;

export type ThemeColorPalette = (typeof Colors)[ColorScheme];

// ─── 4개 앱 테마 런타임 팔레트 ───────────────────────────────────────────────
const rawAppThemes = (themeConfig as unknown as {
  appThemes: Record<AppThemeName, Record<ThemeColorName, string>>;
}).appThemes;

function buildAppPalette(name: AppThemeName): ThemeColorPalette {
  const base = rawAppThemes[name];
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: base.tint ?? base.primary,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
  } as ThemeColorPalette;
}

export const AppThemes: Record<AppThemeName, ThemeColorPalette> = {
  dark_navy: buildAppPalette("dark_navy"),
  clean_sky: buildAppPalette("clean_sky"),
  paper_blue: buildAppPalette("paper_blue"),
  exam_paper: buildAppPalette("exam_paper"),
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
