import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, View } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import { SchemeColors, type ColorScheme } from "@/constants/theme";
import { loadThemePreference, saveThemePreference } from "@/lib/store";
import { applyWebTheme } from "@/lib/web-theme";
import type { ThemeMode } from "@/lib/theme-preference";
export type { ThemeMode } from "@/lib/theme-preference";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themeMode: ThemeMode;
  themeStorageIssue: string | null;
  setThemeMode: (mode: ThemeMode) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);
  const [themeStorageIssue, setThemeStorageIssue] = useState<string | null>(null);

  const applyScheme = useCallback((mode: ThemeMode) => {
    const nativeScheme = mode === "dark" ? "dark" : "light";
    nativewindColorScheme.set(nativeScheme);
    Appearance.setColorScheme?.(nativeScheme);
    if (typeof document !== "undefined") applyWebTheme(mode, document);
    setThemeModeState(mode);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    applyScheme(mode);
    void saveThemePreference(mode).then(() => setThemeStorageIssue(null)).catch(() => {
      setThemeStorageIssue("테마를 저장하지 못했습니다. 다시 선택해 주세요.");
    });
  }, [applyScheme]);

  useEffect(() => {
    let active = true;
    void loadThemePreference().then((mode) => {
      if (active) applyScheme(mode);
    }).catch(() => {
      if (active) {
        setThemeStorageIssue("기존 테마 설정을 읽지 못해 보존했습니다. 원하는 테마를 다시 선택해 주세요.");
        applyScheme("light");
      }
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [applyScheme]);

  const themeVariables = useMemo(() => vars(Object.fromEntries(
    Object.entries(SchemeColors[themeMode]).map(([token, value]) => [`color-${token}`, value]),
  )), [themeMode]);
  const value = useMemo(() => ({ colorScheme: themeMode, themeMode, themeStorageIssue, setThemeMode }),
    [themeMode, themeStorageIssue, setThemeMode]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[
        { flex: 1, minHeight: 0, backgroundColor: !ready && Platform.OS === "web" ? "transparent" : SchemeColors[themeMode].background },
        ready && themeVariables,
      ]}>
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
