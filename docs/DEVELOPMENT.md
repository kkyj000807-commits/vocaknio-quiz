# 개발 진입 지도

현재 완료/배포 상태는 WORKING_CONTEXT.md만 기준으로 삼는다. 이 문서는 파일 위치와 재현 가능한 명령을 안내한다.

## 구조와 책임

확인한 설치 버전: Expo 54.0.29 / Expo Router 6.0.19 / React 19.1.0 / React Native 0.81.5 / TypeScript 5.9.3 / Vitest 2.1.9. 잠금파일은 pnpm-lock.yaml, 패키지 관리자는 pnpm 9.12.0.

| 수정할 기능 | 먼저 볼 파일 | 연결되는 곳 |
|---|---|---|
| 시작·기록 이관·전역 오류 안내 | app/_layout.tsx | lib/vocab-storage-migration.ts, components/learning-storage-notice.tsx |
| 탭·범위 선택 | app/(tabs)/_layout.tsx, index.tsx | lib/vocab.ts |
| 문제 생성·정답 판정 | lib/quiz-engine.ts | app/quiz.tsx, app/wrong-quiz.tsx |
| 검수된 sense 문항 경계 | data/sense-questions.json, lib/sense-questions.ts | 공통 엔진/복원/ProblemSenseContext/결과; audit-sense-questions.ts. 나머지 legacy 출제와 coverage를 구분 |
| 비중복·약점 출제 | lib/adaptive-quiz.ts | lib/store.ts의 세션 선택/응답 기록 |
| 본 문제풀이 중단 복원 | lib/quiz-session.ts | app/quiz.tsx → lib/store.ts의 공통 큐; 마지막 요청 조건/문제/선택지/응답 저장 |
| 통계·오답·북마크·마스터·학습 시간 | lib/store.ts | 각 화면과 hooks/use-study-timer.ts |
| 해설과 문맥 연습 | components/learning-details.tsx, reasoning-practice.tsx | lib/vocab-learning.ts, lib/reasoning-practice.ts |
| 기본 어휘 정본 | assets/vocab-v1.4.json | lib/vocab.ts → 출제 엔진 |
| 검수 해설 원본 | data/vocab-learning/, idiom-corrections.json, expression-composition.json, reasoning-lessons.json | scripts/build-vocab-learning-v1.4.mjs → 인덱스와 public/data/vocab-learning/<버전>/ |
| Light/Paper/Dark·앱 테마 | lib/theme-provider.tsx, lib/theme-preference.ts, lib/web-theme.ts, theme.config.js | app/+html.tsx 초기 paint/모든 화면/저장 큐. v2 light→v3 paper, 신규light |
| 웹 공간·반응형 | lib/layout.ts, components/screen-container.tsx | 탭52px, 끝padding48, 웹max-width880, native inset 보존 |
| 버전·배포 시각 | release.config.json, lib/release-info.ts | app.config.ts, 설정 화면, Production 빌더 |

server/, drizzle/, lib/_core/는 별도 인증·API 경로다. GitHub Pages는 정적 웹이며 서버 배포/계정 동기화까지 완료된 것으로 간주하지 않는다. 사용자 소유 server/auth.ts를 포함한 보존 목록은 WORKING_CONTEXT에 있다.

## 반복 명령 — 저장소 루트에서

1. 잠금: `python scripts/hold-development-lock.py` (대화형 세션 유지, 종료 시 Enter)
2. 변경 후 기본 검증: `node scripts/verify-project.mjs` 또는 `pnpm verify`
   - 학습 데이터 생성·계약 검사 → sense 문항 상태/매핑 감사 → 전체 타입 검사 → 전체 테스트, 실패 시 즉시 중단.
   - 기본 `pnpm test`도 tests/만 탐색한다. 임시 분석 자료를 테스트로 읽지 않는다.
3. 빠른 단위 검증: `node node_modules/vitest/vitest.mjs run tests/learning-storage.test.ts`
4. 변경 파일 lint: `node node_modules/eslint/bin/eslint.js <수정한 ts/tsx/js/mjs 파일>`
5. 웹 개발: `node node_modules/expo/bin/cli start --web --port 8081`
6. Production: `node scripts/build-production-web.mjs <새 빈 출력 폴더>`
   - sense 감사/최신 학습 데이터 생성 → Expo export → KST 버전 정보 → 경로/자산/manifest 감사까지 자동 실행한다.
   - release.json은 version/sourceCommit/sourceDirty/dataVersion/learningDataVersion/builtAt을 기록한다. sourceDirty=true는 커밋만으로 실제 빌드를 재현할 수 없다는 표시다. 공개 HTML/번들 해시와 함께 대조한다.
   - 기존 출력은 덮지 않는다. 이전 빌드와 최신 코드를 혼합하지 않는다.
   - `scripts/audit-production-output.mjs <폴더>`는 복사된 Pages 산출물 재감사에도 쓴다.

브라우저 확인은 코드 검사와 별도다. 답→채점→이전/다음→결과→오답, 북마크, 재접속 복원, 좁은 화면 스크롤을 직접 확인한다. 실제 모바일 Safari를 데스크톱 Chrome으로 대체했다고 보고하지 않는다.

## 기존 동의어 경계 검수 후보 추출

## 영어 능동 인출 데이터

- `data/active-recall-senses.json`은 `word + sense` 단위의 검수된 영영 정의·간결 정의·관계·예문·문항·출처를 저장한다. 원본 38,163행이나 기존 동의어 배열을 덮어쓰지 않는다.
- `candidate / cross-checked / reviewed / production`과 enrichment 상태를 분리한다. production은 독립 출처 2곳, A/B 품질, 예문, 정의/문맥 prompt, 유일 정답과 오답 3개를 모두 만족해야 한다.
- `node --import tsx scripts/audit-active-recall.ts`는 실제 production sense/연결 행/정의/예문/영영 문제 coverage와 실패 상태를 출력한다. legacy 표제어 동의어 행 수를 sense 검증률로 간주하지 않는다.
- 현재 앱은 검수된 항목에 한해 기존 `syn-choice` 진입을 영영 정의·문맥 → 표제어 문제로 우선 전환한다. 정답 전에는 한국어와 표제어를 숨기고, 정답 뒤에는 EN/KR/관계/예문을 분리해 보여준다. 미검수 항목은 기존 경로를 보존한다.
- UI 표시 성공만으로 enrichment 완료로 간주하지 않는다. 정적 데이터 → schema → 문제 생성/채점 → 세션 복원 → Production 번들까지 검증한다.

`node --import tsx scripts/audit-legacy-synonyms.ts`는 현재 데이터로 검수 후보와 전체 건수를 계산한다. 숙어/표현 우선 12개만 표시한다. `"capricious"` 같은 표제어 인자로 좁히거나 `--all`로 전체 후보를 출력할 수 있다. 저장/데이터 변경/자동 출제 제외는 하지 않는다.

- `scripts/lib/legacy-synonym-audit.ts`: concept 우선 조회/표제어 fallback/여러 한국어 뜻 결합을 추적하고 원본 행 ID와 표시 뜻을 남긴다. published/withheld sense 문항에 매핑된 행은 기존 객관식 경로를 타지 않으므로 별도 집계한다.
- `tests/legacy-synonym-audit.test.ts`: 후보 전부의 표시 뜻을 실제 getSynonymDetails와 대조하여 감사 로직의 드리프트를 검출한다.
- 모든 결과는 candidate다. 번역 문구가 다르다고 다른 sense/오답이라고 확정하지 않으며, 후보에 없다고 검수 통과도 아니다. .p는 발음이고 POS가 아니다. 품사/독립 사전/sense/문맥을 확인한 뒤에만 production 데이터를 수정한다.
- 이 검사는 내용이 바뀌지 않은 매시간 자동 실행에서 반복하지 않는다. 관련 데이터/조회 경로가 바뀌었거나 다음 후보를 선정할 때 재사용한다.
- `data/synonym-reviews.json`은 개발용 교차검수 자료이며 production 입력이 아니다. `scripts/lib/synonym-reviews.ts` 계약으로 검사하고 CLI의 reviewState에 별도 집계한다. 원본 뜻/concept/대상 행/결합 표시가 달라지면 stale로 표시한다. stage별 관계 행 수와 고유 sense 수를 구분한다. 이를 앱의 승인된 정답 목록으로 바로 import하지 않는다.
- 명시 검수는 `attachSynonymReviews(VOCAB, reviews)`로 원본을 직접 대조한다. 구조 후보에 없는 관계도 `createLegacySynonymLookup`으로 추적한다. 한 문자열 안에 다른 sense가 섞인 경우 후보에 안 잡힐 수 있으므로 `report.candidates`를 검수 허용 목록으로 사용하지 않는다. 삭제된 원본 관계는 되살리지 않고 stale 처리한다.

## 저장 변경의 계약

- `sense-questions`의 선택적 relation은 source 행ID/뜻/concept와 targetSense를 묶는다. `audit-sense-questions`가 별도 교차검수 snapshot과 대조하며 오래된 근거는 빌드를 막는다. production 적격 문항만 본·오답·단어장에 사용한다.
- 복원/채점은 저장된 sense의 자체 production flag가 아니라 현재 승인 문항과 대조한다. 내용이 바뀐 중단 문항을 자동 재채점하거나 원본을 삭제하지 않는다. 기본 legacy 문항과 보조 모드의 남은 검수 범위는 WORKING_CONTEXT를 참조한다.
- synonym 감사의 reviewState는 교차검수 원본 상태(직접 production0)이고, 실제 출제 coverage는 sense 감사의 production 문항/고유sense/연결행 수다. 두 지표를 합쳐 전체 어휘 검증률로 보고하지 않는다.

- 통계·목록·학습 시간 변경은 기존 learningStorageQueue와 persistLearningEntries를 거친다. AsyncStorage 직접 쓰기를 새로 추가하면 실패 재시도 중 예전 값이 최신 변경을 덮을 수 있다.
- 읽을 수 없는 기존 기록은 원본 그대로 유지하고 저장 경고를 표시한다. 임의 초기화/자동 삭제하지 않는다.
- 저장 실패 시 현재 탭에 미저장 값을 보관한다. 재시도 성공 전 탭 종료까지의 영속성은 보장할 수 없다.
- 잠금/저장 큐는 각각 협력하는 개발 프로세스/한 앱 실행 안의 보호다. 여러 브라우저 탭의 동시 기록을 원자적으로 병합하는 기능은 아직 없다.

## 2026.09.10 병목 검토

| 우선순위 | 확인한 근거 | 이번 대응 |
|---|---|---|
| 1 기록 유실/되살아남 | 병렬 북마크 12개 중 1개만 남음; 실패 중 삭제한 오답 부활; 깨진 통계 덮어쓰기 | 공통 큐/재시도 경로 통일 + 재현 테스트 |
| 2 검사·빌드의 불필요 탐색 | 기본 Vitest가 tmp/pydeps2/bin EPERM으로 중단, Metro도 같은 트리에서 다수 오류 | Vitest tests/ 지정, Metro에서 해당 Python 임시 트리만 제외 |
| 3 배포 준비 누락 | 수동 데이터 생성/검사 순서를 별도로 기억해야 함 | 단일 검증 명령, 빌드 내 생성/감사, 기존 출력 보호 |
| 4 후속 작업의 재탐색 | 과거 todo.md와 현행 구조/공개 배포 상태가 다름 | 이 지도와 단일 상태 문서 사용; 과거 TODO는 이력으로 보존 |

근거 없는 전체 구조 변경, 새 프레임워크/라이브러리 도입, 디자인 변경은 하지 않았다. 다음 후보는 실제 모바일 검증, 문제 세션 중단 복원, 여러 탭의 동시 기록 보호이며 새 실행에서 현재 상태와 재현 근거를 먼저 확인한다.
