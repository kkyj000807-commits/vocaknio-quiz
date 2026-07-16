import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useThemeContext } from "@/lib/theme-provider";

/**
 * Returns the current app theme's color palette (4개 테마 모드 지원).
 * Usage: const colors = useColors(); then colors.text, colors.background, etc.
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const { palette } = useThemeContext();
  if (colorSchemeOverride) return Colors[colorSchemeOverride];
  return palette;
}
