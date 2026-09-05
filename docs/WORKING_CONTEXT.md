# VOCA NEXUS 현재 작업 상태

이 문서는 대화 원문이 아니라 다음 작업을 위한 현재 사실만 유지한다.

## 제품 기준

- 5~10분의 짧은 편입영어 학습, 정답·뜻 정확성, 실제 공개 사이트 사용이 우선이다.
- 숙어가 최우선이다. 숙어·표현은 핵심 탭과 단어장 첫 칸이며 기본 선택이다. 전체 구간 안에만 숨기지 않는다.
- 미색 #F5F0E6, 시스템과 독립된 앱 테마, 자연스러운 세로 스크롤을 유지한다.
- 사용자 표시 명칭은 문제 풀이(하단 문풀), 하단 메뉴는 문풀 → 단어장 → 오답 → 통계 → 설정이다.
- 기출·북마크는 하단에서만 숨겼으며 데이터와 별도 화면은 보존한다.

## 현재 Production

- 버전: 1.7 (직전 공개 1.6)
- 앱 표시: 버전 1.7 · 최근 수정 2026.09.06 00:06 KST · Production 기준
- 공개 URL: https://kkyj000807-commits.github.io/vocaknio-quiz/
- 소스: 2ac375b / Pages: 544854bdce951768037bfd57272b519ca789c5f5
- Pages Actions 33973916372: 2026.09.06 00:09:41 KST 성공 확인.
- 공개 HTTP 검증: 2026.09.06 00:15 KST, 홈·설정·단어장·문제 풀이 HTTP 200, 모두 새 번들 참조.
- 번들: entry-1022726008137d5d7ed8cdfb8e3b80da.js
- 공개/로컬 번들 SHA256 일치: 916470857dc49064d813346674f9c0dff767ca03b1a669a8bcf137680ff160f9
- 1.7 학습 JSON 8개: HTTP 200, 버전 및 전체 JSON 내용이 빌드본과 일치.
- 기존 해시 자산과 이전 학습 파일은 보존했다. 새 학습 데이터는 /data/vocab-learning/1.7/에 있다.

## 이번 변경과 데이터 범위

- 단어장 순서: 숙어·표현 → 전체 → V101 → V201 → V301 → V401 → V501 → V502 → V601 → 부록.
- 숙어·표현은 핵심 범위 첫 번째이며 단어장 기본 선택이다. 기존 모든 구간과 38,163개 ID·번호를 보존했다.
- 1.5: p.14 등 쪽수만 남은 20개 항목의 실제 뜻과 해설·예문을 복구했다.
- 1.6: 17개 추가 표현을 독립 사전 2곳씩 대조해 43개 반복 수록 항목에 해설을 연결했다.
- 1.7: 12개 추가 표현/36개 반복 수록 행의 뜻·한영 해설·뉘앙스·혼동 구분·예문을 독립 사전 2곳씩 대조해 보완했다.
- 이번 표현: abide by, teem with, wrap up, capitalize (on), clamp down on, work out, crack down on, delve into, put A at ease, to boot, by the same token, in the face of A.
- clamp down on/crack down on은 근거 없는 고정 강도 순위를 만들지 않고 같은 기본 뜻으로 정리했다. work out의 해결·계산·잘 풀림·운동, in the face of의 직면/양보를 문맥에 따라 구분했다.
- data/idiom-corrections.json이 수정 뜻·한영 풀이·기억 고리·쓰임·편입 함정·예문·검수 출처를 관리한다.
- 재배포 허가 없는 사전 정의 원문은 복제하지 않는다. Oxford·Collins·Merriam-Webster 등의 뜻을 대조한 자체 영영 풀이·한국어 해설·창작 예문이다. 앱에서는 영영 풀이 · 사전 대조로 구별한다.
- 기존 WordNet 원문 40개 학습 엔트리 + 보완 99개 행별 엔트리 = 139개 엔트리, 218개 목록 연결. 이는 서로 다른 숙어 139개가 검수됐다는 뜻이 아니다.
- 이번 숙어 검수 날짜는 2026.09.05이며 공개 빌드는 자정을 넘어 2026.09.06이다. 검수일과 배포 시각을 같은 날짜로 임의 덮어쓰지 않는다.
- 앱의 숙어·표현 필터: 3,731개 수록 행, 정확한 소문자 표제어 기준 1,877개. 구동사·연어·고유명사도 포함되어 있다. 이 전 범위 해설 검수는 아직 완료되지 않았다.
- 기존 Claude 검수는 옛 번호 체계다. look after·run into는 현재 표제어와 사전 대조로 재활용했고, put on은 현재 형용사 풀이여서 옛 착용하다 동사 풀이로 덮지 않았다.
- 발음은 허가된 미국식 실제 녹음 17개, 나머지 en-US 합성음이다. 전부 공식 사전 녹음이라고 보고하지 않는다.

## 학습·출제 상태

- 단어장 현재 범위에서 10문제 직행, 작게 보이는 발음 버튼(실효 터치 44px), 뜻 터치 가림·복원을 유지한다.
- 일반·오답 문제 풀이의 이전·다음과 답·해설 복원, 명확한 가로 제스처를 유지한다. 세로 스크롤이 우선이다.
- 1.5에서 최근 세션 전체 문항 + 최근 3개 관련 세션의 정답·마스터 표제어를 우선 제외하고 저노출 문항을 먼저 출제한다. 풀이 대상이 부족할 때만 오래된 보호부터 완화한다.
- 같은 표제어의 여러 수록 행은 통합 학습 이력으로 판단한다. 최신 정답은 과거 오답 가산점을 해제한다.
- 세션 최소 75%는 범위 순환, 최대 25%는 약점 복습이다.
- 동의어 부족 시 syn-choice·syn-kor-choice·syn-type에서 한국어 뜻 문제로 전환하여 요청 문항 수를 확보하고 전환 이유를 표시한다.
- 적응형 이력은 브라우저 로컬이다. 저장 실패 시 현재 실행 중 기록을 유지하고 다음 변경 때 재시도한다. 브라우저 종료 후 영속성이 보장되는 것은 저장 성공분뿐이다.
- 기기·브라우저 간 동기화와 개인별 오답 보기 생성은 아직 미완료다.

## 검증과 한계

- 전용 TypeScript: 통과.
- 관련 Vitest: 7파일 55테스트 통과(2026.09.06 00:15~00:16 KST). 명령에 --dir tests를 넣어 사용자 tmp/pydeps2의 OneDrive 접근 오류를 피한다.
- 정본 감사: 38,163개, 동의어 항목 11,277개, 유효 연결 65,219개 통과.
- Production 빌드: 성공. HTML 21개, 경로 누락·참조 누락·루트 /assets/ 및 /_expo/ 참조 0.
- 남아 있는 빌드 경고: 사용자 tmp/pydeps2 일부 EPERM 스캔 제외, 오래된 Browserslist, NO_COLOR/FORCE_COLOR 충돌. 앱 자산 누락은 없다.
- 실제 Windows Chrome: 1.6을 표시하던 설정 화면을 일반 새로고침하여 1.7/2026.09.06 00:06 KST로 갱신됨을 확인했다. 캐시 삭제·강력 새로고침·버전 쿼리는 사용하지 않았다.
- 공개 Chrome 단어장: 숙어 첫 칸/기본 선택/3,731개, abide by의 새 뜻·한영 해설·예문·사전 출처 펼침, 검색과 미색 화면·세로 스크롤을 확인했다. in the face of 검색 결과 6개 행도 모두 새 뜻으로 표시됐다.
- 1.6에서 인앱 Chromium의 숙어 10문제 진입, 정답→다음→이전 시 정답 1 유지까지 확인했다. 이 학습 흐름은 1.7에서 코드를 변경하지 않았다.
- 실제 iOS Safari/모바일 Chrome 터치 확인은 아직 하지 못했다. Windows Chrome 결과를 모바일 양쪽 확인으로 대체하지 않는다.
- Chrome 해설 확장 패널에는 내용이 표시된 뒤에도 로딩 문구가 남는 현상을 관찰했다. 해설은 읽을 수 있으나 로딩 상태 종료·재시도 처리 추가 점검이 필요하다.
- 전체 tsc: tests/vocab.test.ts의 삭제 API 3개(getForbiddenSyns/getSynDistractors/getKorDistractors) import로 실패. 관련 전용 통과와 구분한다.
- 기존 Pages 404.html은 이전 호환 파일을 유지한다. 정상 공개 라우트 4개는 200 확인했지만 존재하지 않는 경로/복구 동작은 이번에 추가 검증하지 않았다.

## 다음 한 가지

숙어 해설 미연결 표현을 우선순위화하여 실제 사전 대조 → 자체 한영 설명·예문 → 같은 뜻의 반복 행 연결 → 공개 검증 순서로 확장한다. 빈 칸을 채우려고 미검증 내용을 대량 생성하지 않는다.

## 보존 및 재개 절차

- 사용자 소유 server/auth.ts, analysis/, build/, output/, pnpm-workspace.yaml, qa_claude/, scripts의 exam 분석 파일, tmp/, vocab_project/는 수정·커밋하지 않았다.
- auth 상태/원격 SHA 확인 → 관련 검사 → node scripts/build-production-web.mjs <새 출력 폴더> → node scripts/audit-production-output.mjs <출력 폴더> → 목적 파일만 main 커밋/push → 별도 Pages worktree에 빌드 덮어쓰기(기존 해시 자산 보존) → gh-pages push → Actions/공개 JSON/실제 화면 확인.
- 버전은 release.config.json 한곳, Production 성공 시 +0.1. 다음 후보는 1.8.
- 제한된 실행 환경의 gh keyring 접근 실패는 token invalid로, pnpm 링크 접근 실패는 패키지 누락으로 보일 수 있다. 이번에는 승인된 정상 실행 환경에서 인증·dry-run·55테스트가 통과했다. 이를 확인하지 않고 재로그인·재설치를 사용자에게 반복 요구하지 않는다.
- 전용 검사: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.vocab-v1.4.json
- 테스트: node node_modules/vitest/vitest.mjs run --dir tests tests/adaptive-quiz.test.ts tests/adaptive-store.test.ts tests/us-pronunciation.test.ts tests/vocab-learning.test.ts tests/vocab-migration-v1.4.test.ts tests/vocab-storage-migration-v1.4.test.ts tests/vocab-v1.4.test.ts
- 감사: node node_modules/tsx/dist/cli.mjs scripts/audit-quiz-engine-v1.4.ts
