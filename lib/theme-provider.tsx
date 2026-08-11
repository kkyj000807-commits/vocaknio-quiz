import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

export type ThemeMode = "dark" | "light" | "system";

const THEME_KEY = "vocaknio_theme_mode";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemScheme(): ColorScheme {
  const sys = Appearance.getColorScheme();
  return sys === "light" ? "light" : "dark";
}

function resolveScheme(mode: ThemeMode): ColorScheme {
  if (mode === "system") return getSystemScheme();
  return mode;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 초기값을 시스템 테마로 설정 (다크 하드코딩 제거)
  const initialSystemScheme = getSystemScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(initialSystemScheme);
  // AsyncStorage 로드 완료 여부 — 로드 전까지 렌더링 지연으로 색상 플래시 방지
  const [ready, setReady] = useState(false);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setThemeModeState(mode);
      const scheme = resolveScheme(mode);
      setColorSchemeState(scheme);
      applyScheme(scheme);
      try {
        await AsyncStorage.setItem(THEME_KEY, mode);
      } catch {}
    },
    [applyScheme]
  );

  // Load persisted theme on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      // 저장된 값이 없으면 시스템 테마 사용 (기존 "dark" 기본값 제거)
      const mode: ThemeMode = isThemeMode(saved) ? saved : "system";
      const scheme = resolveScheme(mode);
      setThemeModeState(mode);
      setColorSchemeState(scheme);
      applyScheme(scheme);
      setReady(true);
    });
  }, [applyScheme]);

  // Listen for system theme changes when mode is "system"
  useEffect(() => {
    if (themeMode !== "system") return;
    const sub = Appearance.addChangeListener(({ colorScheme: sys }) => {
      const scheme = sys === "light" ? "light" : "dark";
      setColorSchemeState(scheme);
      applyScheme(scheme);
    });
    return () => sub.remove();
  }, [themeMode, applyScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-primary2": SchemeColors[colorScheme].primary2,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-card": SchemeColors[colorScheme].card,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-dim": SchemeColors[colorScheme].dim,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
        "color-tint": SchemeColors[colorScheme].tint,
      }),
    [colorScheme]
  );

  const value = useMemo(
    () => ({ colorScheme, themeMode, setThemeMode }),
    [colorScheme, themeMode, setThemeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>
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
