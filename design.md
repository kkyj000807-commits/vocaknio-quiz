# 보카니오 편입 동의어 퀴즈 — Design Document

## Brand Identity
- **App Name**: 보카니오 퀴즈 (Vocaknio Quiz)
- **Tagline**: 편입 실전 동의어 암기
- **Tone**: 다크 테마, 프리미엄 학습 앱 느낌 (Duolingo + Anki 중간)
- **Color Palette**:
  - Background: `#07080f` (deep dark navy)
  - Surface: `#0d0e1a` (card background)
  - Primary Accent: `#6c63ff` (purple)
  - Secondary Accent: `#a78bfa` (lavender)
  - Success: `#34d399` (green)
  - Error: `#f87171` (red)
  - Warning: `#fbbf24` (amber)
  - Text Primary: `#eeeef8`
  - Text Muted: `#9898b8`
  - Text Dim: `#55556a`

## Screen List

1. **Home (Setup) Screen** — 퀴즈 설정 화면
2. **Quiz Screen** — 실전 퀴즈 (4지선다 동의어, 한국어 뜻, 플래시카드, 직접입력)
3. **Result Screen** — 퀴즈 결과 및 오답 목록
4. **Stats Screen** — 학습 통계 (정답률, 학습 단어 수)
5. **Bookmark Screen** — 북마크한 단어 목록

## Primary Content & Functionality

### Home Screen
- 앱 타이틀 + 총 단어 수 배지
- 퀴즈 모드 선택 (4가지): 동의어 고르기, 한국어 뜻 고르기, 플래시카드, 직접 입력
- 단어 범위 선택: 1~1000, 1001~2000, ... 전체
- 문제 수 선택: 10, 20, 30, 50
- 퀴즈 시작 버튼

### Quiz Screen
- 진행 상태 바 (progress bar)
- 정답/오답/진행 카운터
- 단어 카드 (영단어 + IPA 발음기호)
- 선택지 4개 (동의어 or 한국어 뜻)
- 정답 후 해설 패널 (동의어 태그, 한국어 뜻)
- 다음 문제 버튼
- 북마크 버튼

### Result Screen
- 최종 점수 (퍼센트)
- 정답/오답 수
- 오답 단어 목록 (단어 + 뜻)
- 다시 풀기 / 오답만 다시 / 홈으로 버튼

### Stats Screen
- 총 학습 단어 수
- 전체 정답률
- 오늘 학습 수
- 연속 학습일 (streak)

### Bookmark Screen
- 북마크된 단어 목록
- 단어 + IPA + 한국어 뜻 + 동의어 표시
- 북마크 해제 버튼
- 북마크 단어로 퀴즈 시작 버튼

## Key User Flows

1. **기본 퀴즈 플로우**: Home → 모드/범위/수 선택 → 퀴즈 시작 → 문제 풀기 → 결과 확인
2. **오답 복습 플로우**: 결과 화면 → 오답만 다시 → 퀴즈 → 결과
3. **북마크 플로우**: 퀴즈 중 북마크 → 북마크 탭 → 북마크 단어 퀴즈

## Tab Navigation
- Tab 1: 퀴즈 (house icon) — Home/Quiz/Result
- Tab 2: 통계 (chart icon)
- Tab 3: 북마크 (bookmark icon)
