import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import {
  AppThemes,
  DEFAULT_APP_THEME,
  schemeOfTheme,
  type AppThemeName,
  type ColorScheme,
  type ThemeColorPalette,
} from "@/constants/theme";

const THEME_KEY = "vocaknio_theme_mode";

type ThemeContextValue = {
  colorScheme: ColorScheme;          // 이진 스킴 (상태바·dark 클래스용)
  themeName: AppThemeName;           // 현재 앱 테마
  palette: ThemeColorPalette;        // 현재 테마 팔레트
  setThemeName: (name: AppThemeName) => void;
  /** @deprecated 이전 API 호환 — themeName 사용 권장 */
  themeMode: AppThemeName;
  /** @deprecated 이전 API 호환 — setThemeName 사용 권장 */
  setThemeMode: (name: AppThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 저장된 레거시 값('dark'|'light'|'system') → 새 테마 이름 마이그레이션 */
function migrateStored(saved: string | null): AppThemeName {
  if (saved === "dark" || saved === "dark_navy") return "dark_navy";
  if (saved === "clean_sky" || saved === "paper_blue" || saved === "exam_paper") {
    return saved;
  }
  // 'light' | 'system' | null | 알 수 없는 값 → 기본 테마
  return DEFAULT_APP_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<AppThemeName>(DEFAULT_APP_THEME);
  // AsyncStorage 로드 완료 여부 — 로드 전까지 렌더링 지연으로 색상 플래시 방지
  const [ready, setReady] = useState(false);

  const applyTheme = useCallback((name: AppThemeName) => {
    const scheme = schemeOfTheme(name);
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = name;
      root.classList.toggle("dark", scheme === "dark");
      const palette = AppThemes[name];
      Object.entries(palette).forEach(([token, value]) => {
        if (typeof value === "string") root.style.setProperty(`--color-${token}`, value);
      });
      if (document.body) document.body.style.backgroundColor = palette.background;
    }
  }, []);

  const setThemeName = useCallback(
    async (name: AppThemeName) => {
      setThemeNameState(name);
      applyTheme(name);
      try {
        await AsyncStorage.setItem(THEME_KEY, name);
      } catch {}
    },
    [applyTheme]
  );

  // Load persisted theme on mount (레거시 값 마이그레이션 포함)
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      const name = migrateStored(saved);
      setThemeNameState(name);
      applyTheme(name);
      setReady(true);
    });
  }, [applyTheme]);

  const palette = AppThemes[themeName];
  const colorScheme = schemeOfTheme(themeName);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": palette.primary,
        "color-primary2": palette.primary2,
        "color-background": palette.background,
        "color-surface": palette.surface,
        "color-card": palette.card,
        "color-foreground": palette.foreground,
        "color-muted": palette.muted,
        "color-dim": palette.dim,
        "color-border": palette.border,
        "color-success": palette.success,
        "color-warning": palette.warning,
        "color-error": palette.error,
        "color-tint": palette.tint,
      }),
    [palette]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      themeName,
      palette,
      setThemeName,
      themeMode: themeName,
      setThemeMode: setThemeName,
    }),
    [colorScheme, themeName, palette, setThemeName]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1, backgroundColor: palette.background }, themeVariables]}>
        {/* AsyncStorage 로드 완료 후에만 렌더링 — 색상 플래시(flash) 방지 */}
        {ready ? children : null}
      </View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
