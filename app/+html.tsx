import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// 빌드 시점에 결정되는 배포 경로 (GitHub Pages: /vocaknio-quiz)
const BASE = process.env.EXPO_BASE_URL ?? "";

// 아이폰 사파리 사용성 개선 CSS
const safariPolishCss = `
  html, body {
    /* 글자 선명도 향상 (시인성) */
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    /* 가로 스크롤/바운스 방지 */
    overscroll-behavior-y: contain;
  }
  /* 버튼/카드 탭 시 회색 깜빡임 제거 */
  * {
    -webkit-tap-highlight-color: transparent;
  }
  /* 입력창 포커스 시 사파리 자동 확대 방지 (16px 이상 유지) */
  input, textarea, select {
    font-size: 16px;
  }
  /* 더블탭 확대로 인한 버튼 오작동 방지 */
  button, [role="button"] {
    touch-action: manipulation;
  }
`;

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
        {/* 기본 테마 paper_blue 초기 페인트 색 (로드 후 테마 프로바이더가 갱신) */}
        <meta name="theme-color" content="#FFFDF7" />
        <link rel="apple-touch-icon" href={`${BASE}/apple-touch-icon.png`} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VOCA NEXUS" />
        <ScrollViewStyleReset />
        {/* Safari 웹 편의성·시인성 개선 */}
        <style dangerouslySetInnerHTML={{ __html: safariPolishCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
