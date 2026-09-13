import themeConfig from "../theme.config";
import { LEGACY_THEME_KEY, THEME_KEY, type ThemeMode } from "./theme-preference";

/** Shared by the pre-paint HTML script and the hydrated ThemeProvider. */
export function applyWebTheme(mode: ThemeMode, doc: Document, swatches = themeConfig.themeColors) {
  const root = doc.documentElement;
  const scheme = mode === "dark" ? "dark" : "only light";
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = scheme;
  for (const [token, swatch] of Object.entries(swatches)) {
    root.style.setProperty(`--color-${token}`, swatch[mode]);
  }
  root.style.backgroundColor = swatches.background[mode];
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute("content", scheme);
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", swatches.background[mode]);
}

// Read-only: migration runs later through the existing storage queue.
export function getThemeBootstrapScript() {
  return `(()=>{let mode="light";try{const raw=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(raw!==null){const value=JSON.parse(raw);if(value==="light"||value==="paper"||value==="dark")mode=value;}else{const old=localStorage.getItem(${JSON.stringify(LEGACY_THEME_KEY)});mode=old==="dark"?"dark":old==="light"?"paper":"light";}}catch{}(${applyWebTheme.toString()})(mode,document,${JSON.stringify(themeConfig.themeColors)});})();`;
}
