import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

export type ThemeMode = "dark" | "light";

const THEME_KEY = "vocaknio_theme_mode_v2";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 브라우저별 시스템 설정과 무관하게 검증된 밝은 팔레트로 시작한다.
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("light");
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
      const scheme = mode;
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
    let active = true;

    const loadTheme = async () => {
      let mode: ThemeMode = "light";

      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        mode = isThemeMode(saved) ? saved : "light";
        if (saved !== mode) {
          await AsyncStorage.setItem(THEME_KEY, mode);
        }
      } catch {
        // Safari private mode or blocked storage must not leave a blank screen.
      }

      if (!active) return;
      const scheme = mode;
      setThemeModeState(mode);
      setColorSchemeState(scheme);
      applyScheme(scheme);
      setReady(true);
    };

    void loadTheme();
    return () => {
      active = false;
    };
  }, [applyScheme]);

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
