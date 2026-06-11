import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// 빌드 시점에 결정되는 배포 경로 (GitHub Pages: /vocaknio-quiz)
const BASE = process.env.EXPO_BASE_URL ?? "";

// 웹 정적 빌드의 HTML 루트. 아이폰 홈 화면 추가 아이콘 및 PWA 메타 설정.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>VOCA NEXUS</title>
        <meta name="theme-color" content="#060D1F" />
        <link rel="apple-touch-icon" href={`${BASE}/apple-touch-icon.png`} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VOCA NEXUS" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
