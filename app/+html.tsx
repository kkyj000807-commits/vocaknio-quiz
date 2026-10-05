import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import themeConfig from "../theme.config";
import { getThemeBootstrapScript } from "../lib/web-theme";
import { PRODUCT_NAME, PRODUCT_PHILOSOPHY } from "../constants/brand";

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <title>{PRODUCT_NAME}</title>
        <meta name="description" content={PRODUCT_PHILOSOPHY} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="only light" />
        <meta name="theme-color" content={themeConfig.themeColors.background.light} />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
