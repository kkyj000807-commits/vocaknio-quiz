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
        <meta property="og:title" content={PRODUCT_NAME} />
        <meta property="og:description" content={PRODUCT_PHILOSOPHY} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kkyj000807-commits.github.io/vocaknio-quiz/" />
        <meta property="og:image" content="https://kkyj000807-commits.github.io/vocaknio-quiz/brand/finetune-share-v2.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:alt" content="FINETUNE 파인튠 FT 로고" />
        <meta name="twitter:card" content="summary" />
        <meta name="apple-mobile-web-app-title" content={PRODUCT_NAME} />
        <link rel="apple-touch-icon" sizes="180x180" href="/vocaknio-quiz/brand/finetune-touch-v2.png" />
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
