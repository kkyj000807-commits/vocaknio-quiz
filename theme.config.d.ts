type Swatch = { light: string; dark: string };

export const themeColors: {
  primary: Swatch;
  primary2: Swatch;
  primarySoft: Swatch;
  background: Swatch;
  surface: Swatch;
  card: Swatch;
  foreground: Swatch;
  muted: Swatch;
  dim: Swatch;
  border: Swatch;
  success: Swatch;
  successText: Swatch;
  warning: Swatch;
  warningText: Swatch;
  error: Swatch;
  errorText: Swatch;
  tint: Swatch;
};

type AppThemePalette = {
  primary: string;
  primary2: string;
  primarySoft: string;
  background: string;
  surface: string;
  card: string;
  foreground: string;
  muted: string;
  dim: string;
  border: string;
  success: string;
  successText: string;
  warning: string;
  warningText: string;
  error: string;
  errorText: string;
  tint: string;
};

export const appThemes: {
  dark_navy: AppThemePalette;
  clean_sky: AppThemePalette;
  paper_blue: AppThemePalette;
  exam_paper: AppThemePalette;
};

declare const themeConfig: {
  themeColors: typeof themeColors;
  appThemes: typeof appThemes;
};

export default themeConfig;
