# VOCA NEXUS 현재 작업 상태

기준: 2026.09.13 22:46 KST. 구조/명령은 docs/DEVELOPMENT.md, 운영 규칙은 docs/AI_WORK_RULES.md, 자동 실행은 docs/AUTOMATION_RUNBOOK.md를 따른다. 이 파일이 단일 현재 상태이며 과거 todo/대화/자동화의 1.8 후보 문구보다 우선한다.

## 현재 batch — 문제엔진 P0 우선, 2.1 후보 미배포

최신 Master/Compiler 지시를 AI_WORK_RULES에 통합했다. 재현된 정답·sense 문제를 UI/P2보다 우선한다. 기존 UI 변경과 학습 데이터 batch는 보존하며 전체 로드맵 완료를 주장하지 않는다.

- VERIFIED: sanction496의 승인/제재가 한 뜻에 섞이고 형용사 erratic/faddish/fickle이 동사 오답으로 생성됨을 고정 난수로 재현. getSynonymDetails의 headword fallback과 여러 뜻 결합, headword 배열 기반 채점이 원인 경로다.
- DONE: data/sense-questions.json의 sanction/all but 2표현·4sense·4문항·기존10행을 문맥/정답/3오답/이유/2사전 근거로 분리. 후보/검수/production 상태와 A/B/C gate; 본·오답 공통 해설·문맥, 정답 ID 채점, 실제 선택지/뜻 snapshot 복원 연결. production은 데이터의 출제 적격 상태이지 공개 게시 완료가 아니다.
- VERIFIED: 216개 seed/mode/item 조합 생성, 선택지 역순 채점, 잘못된 정답/중복/근거 부족/C/복원 손상 거절. 전체 데이터 검사·tsc·137테스트 통과(09.13 01:39 시작), 기존 인증 테스트1개 조건부 skip. 편집 품질 A는 AI의 검수 판단이며 학습 효과/전체 어휘 품질의 증명이 아니다.
- DONE: 플래시카드/직접입력은 삭제 없이 보조 학습 접기 영역으로 이동. 새4유형 전체/자동 오늘학습은 NOT DONE.
- VERIFIED(단위/저장 테스트): Light/Paper/Dark 토큰·설정·DOM, v2 light→v3 paper/dark 유지/신규light, 옛 설정·학습 기록 보존, 저장 실패/손상 원본 보존. 로컬 Windows Chrome390px에서 신규Light·Paper 전환/새로고침 확인(09.11 UI 후보).
- DONE / 추가 화면 검증 대기: 웹 탭52px/아이콘21/터치44이상, 끝padding48, 웹 max-width880. native inset 보존. Chrome 측정 탭 터치47.2px. 현재 P0 포함 빌드에서 재확인 필요.
- DONE / 빌드 검증 대기: release manifest sourceCommit/sourceDirty/dataVersion/learningDataVersion/builtAt와 KST 동일 기준 시각, metadata audit.
- VERIFIED: 변경 파일 lint 오류0/경고5(기존 미사용 import4, themeConfig default-member1). 별도 도구 module-format 경고. 버전2.1 후보 빌드 진행 중이며 공개는2.0이다.
- NOT DONE: 검색 측정 median14.97ms/p95 70.21ms(실제38163행8검색×10) 이후 최적화. 북마크 state로 랜덤 재shuffle되는 코드 확인, 수정 보류. 오답 세션 복원/공통 제스처, CI/오래된 PR 비교 보류(삭제 금지).
- NOT DONE: 현재 후보 production build/audit, 본·오답 실제 답→해설→결과→복습/새로고침, 3테마/태블릿/desktop/마지막 스크롤, 공개2.1 배포.
- BLOCKED: 실제 Galaxy Tab Samsung Internet/Chrome 및 iPhone Safari 연결 없음. 데스크톱 viewport를 실기기라고 보고하지 않는다.

현재 잠금 session79613/PID19780 유지. 다음: 선별 소스 커밋→최종 빌드→공개 확인. 사용자 server/auth.ts와 모든 기존 untracked는 보존한다. Git fetch09.13: HEAD=origin/main1d6c4ac, gh-pages be269b8, 인증 정상.

### 최신 검증 결과 (앞의 검증 대기 항목을 대체)

- VERIFIED: 전체 verify138테스트/tsc/데이터 감사(09.13 01:50), 인증1개 조건부 skip. 재검사에서 처음 store import가 Vitest 대형JSON 변환까지 hook10초에 포함돼 시간 초과했다. 실제 모듈 최초 로드를 수집 단계로 옮겼고 매 테스트 reset/reopen과 모든 실패·기록 검사는 그대로 유지했다. 해당 hook624ms, timeout을 늘리거나 테스트를 약화하지 않았다.
- VERIFIED: 최종 후보 Production 빌드/HTML22/JSON8/basepath/manifest audit. 후보2.1 01:49 KST, entry-8df92c4c9c5c44fcdc71ae29e0aa79b2.js. 최종 소스 커밋 뒤 배포용 빌드는 별도 생성한다.
- VERIFIED: 로컬 Windows Chrome sanction 문맥→오답→일반 새로고침(같은 문맥/보기/오답1)→결과→오답 복습 authorize 더블클릭→결과1/1, 이중 채점 없음. 결과 화면이 옛 혼합 뜻/동의어를 다시 표시하던 경로를 수정해 두 뜻을 각각 문맥과 함께 표시한다. 응답 후 문맥이 아래로 이동하던 현상도 수정·확인.
- VERIFIED: 후보/보류 sense가 legacy 뜻 fallback이나 오답 출제로 우회하지 않는 테스트 추가. 본·오답 기록은 아직 headword 번호 기반으로 묶이며 특정 실패 sense를 다음 오답 출제로 고정하는 기능은 NOT DONE.
- VERIFIED: Chrome 신규Light, Dark/Paper 선택 후 일반 새로고침 복원, 앱 배경·color-scheme 일치. 390×844 탭52px/각 터치47.2px, 설정 마지막 링크가 탭 위로 스크롤됨. 800×1280 단어장 검색2행,1280×800 max-width880 및 펼친 마지막 해설/출처44px 버튼 접근,1440×900 통계 배치 확인. 기본3모드·보조2모드 펼치기, 북마크 추가 확인. 콘솔 error0.
- NOT DONE: 실제 Samsung Internet/Android Chrome/iPhone Safari, 브라우저 강제 다크 ON/OFF, 실제 기존 v2→v3 브라우저 이관(단위/저장 검사만 통과), 모든 테마×모든 화면 교차 전수 검증. 임시 Chrome viewport는 실기기 검증이 아니다.
- 시간: 01:50 이후22:40 재개 사이 공백을 개발시간으로 합산하지 않는다. 공개2.0 유지,2.1 게시 전 전체 완료 선언 금지.

### 미완료 최신 필수 명세

- P0: 나머지 전체 어휘의 sense/POS/source 경계, 한국어 의미 겹침·동의어/반의어/다의어 대량QA, 일반 distractor 품질 게이트. 현재 4문항 밖의 legacy 출제를 A로 인증하지 않는다. 옛 중단 세션은 기록 보호를 위해 임의 재작성하지 않는다.
- P1: 오늘 학습 원터치 자동 queue와 네 가지 기본 문제 유형; 현재 세부 모드는 보존. 남은 태블릿/UI 실검증과 랜덤 안정성.
- P2: 확실히 추론 가능한 오답 원인/유형 전환/sense mastery/학교별 기출 약점 환류. 사용자 성적 하드코딩 금지.
- 콘텐츠: 반복 가능한 후보→교차검수→생산 pipeline 전반은 아직 NOT DONE. 현재 좁은 production schema/audit만 있으며 깊이 학습139sense/218행, 문맥연습6표현/13문항/17행, 새 본문풀4문항/10행을 서로 합쳐 전수 coverage라고 하지 않는다.
- P3: CI·multi-tab 보호·정당한 중복 공통화·오래된 PR 가치 비교. 새 기능/전면 개편보다 현재 P0 batch 닫기 우선.

## 목표와 작업 계약

- 편입영어 독해·논리에서 단어/숙어를 새 문맥에 적용해 점수를 얻는다. 숙어부터 완성한 뒤 일반 단어로 확장한다.
- 데이터 보존·정답 정확성 → 장애/회귀 → 학습 흐름/기록 → 필수 기능 → 근거 있는 사용성 개선 순서.
- 기존 미색 #F5F0E6은 Paper로 보존, 신규는 white Light 기본. Dark/앱 독립 테마/세로 스크롤/문풀→단어장→오답→통계→설정/숙어 첫 범위 보존.
- 한 대화/같은 main에 누적. 새 대화·보조 작업·자동화를 만들지 않는다. 사용자 미커밋 작업 보존.
- 의미핵이 최신 학습 보강 최우선. 핵심 뜻→영영 의미핵→쉬운 한국어 설명→뜻별 확장 지도→유의어 차이/예문/문항. 도움이 없는 장황한 설명·억지 어근·연결되지 않는 뜻의 강제 통합 금지.
- 역사적 어원/확인된 의미 변화/현대 개념 설명/암기 이미지 구분. 독립 사전2개 대조, 개념적 추론을 역사나 원어민 전체의 심리로 단정하지 않는다. 무료 열람과 재배포 허가를 구분한다.
- 해설/문항 작업은 .agents/skills/transfer-english-reasoning/SKILL.md와 두 references를 읽는다. 공개 강의 원칙과 앱 독자 설계·효과 실측을 구분한다.
- 코드 존재≠완료. 한 batch를 조사→실제 데이터→단어장/문풀 연결→검사→브라우저→공개 확인까지 닫는다. 추가 아이디어는 보류 목록에 두고 현재 batch부터 마친다.

## 현재 Production — 2.0 공개 반영 확인

- URL: https://kkyj000807-commits.github.io/vocaknio-quiz/
- 직전1.9(2026.09.10 10:25 KST) → 현재2.0(2026.09.10 15:36 KST).
- 15:36은 앱에 표시되는 빌드/최근 수정 기준. 실제 Pages 게시 성공은20:32:26 KST. 긴 작업 공백을 실제 개발시간으로 보고하지 않는다.
- 소스1d6c4ac / Pages be269b8eb68e3eef99713c720c567a59762a0db7 / Actions34471341591 success.
- 번들 entry-98dd5ac639d746788407effca6f2d608.js / SHA256 b3da9e22f33e02fdc65de57cf84769c98cc41edb29bfcf2801acba49aa0e9ca6.
- 공개 root/settings/wordbook/quiz HTTP200, 번들 SHA·학습JSON8개 로컬 산출물과 일치(20:32 확인).
- 실제 Windows Chrome: 공개1.9 설정 탭을 일반 새로고침해2.0/15:36 확인. 단어장 all but→의미핵4단계/예문/3번째 문맥 문제 표시, 콘솔 error0. 공개에서는 테스트 답을 제출해 사용자 성적을 추가하지 않았다.
- 캐시: 검사한 Chrome 탭의1.9→2.0 갱신 확인. 오래 열린 다른 탭/모든 캐시 조건/실제 모바일 Safari·Chrome는 미검증. 데스크톱390px을 실기기로 부르지 않는다.
- 산출물: C:\Users\USER\Documents\Codex\2026-08-03\realtime-voice-chat\work\vocanexus-production-2.0-20260910
- Pages worktree: 같은 work 아래 vocanexus-pages-2.0-20260910. 이전 해시 자산/1.4~1.9 JSON은 삭제·변경하지 않았다.
- 게시 병목:20:27 push 후 deploy 단계가 약5분 걸림. 진행 중 공개1.9 반환은 예상된 미게시 상태였다. 성공 전 재push/설정 변경은 하지 않았다.

## 이번 batch 완료 감사 — 전체 작업은 부분 완료

상태: VERIFIED=명시한 환경에서 실행 검증 / DONE=구현 후 일부 검증 대기 / BLOCKED=외부 제약 / NOT DONE=미완료.

- VERIFIED: 기존 schema 재사용 조사. lib/reasoning-practice.ts의 optional coreMeaning, scripts/lib/reasoning-lessons.mjs 검증, components/learning-details.tsx 공통 표시를 사용했다.
- VERIFIED: all but 1표현/기존2행(num281,2060)에 실제 의미핵 데이터 적용. Cambridge/Collins의 두 현재 쓰임 대조, 짧은 뜻/영영 핵/한국어 연결/확장2경로/창작 대조 예문2개/출처/적용 한계 포함.
- VERIFIED: kind=conceptual, 현대 의미 설명·역사적 어원 아님 표시. 기존 기억 고리/직역 반복 표시는 새 core가 있을 때만 숨기고 원본 데이터는 보존했다.
- VERIFIED: 기존 all but 문항 ID2개 유지, allbut-core-transfer-1 추가. 총 문맥 연습6표현/13문항/17개 수록 행 연결. 새 정답b와3오답의 sense/범위/부정 반례 검토. 영영 핵/예문/문항은 사전 원문 복사가 아닌 자체 편집·창작.
- VERIFIED: 로컬 실제 Chrome 단어장 검색2행/해설4단계/출처, 뜻 가림 시 접근성 트리에서 core 제거. 본 문풀281은 정답 전 해설 없음→정답 후 같은 core/3문항 표시.
- VERIFIED: 새 문맥 문제 선택→정답·지문 근거·오답 이유, 일반 새로고침 후 본 문제 동일 선택지/정답1 유지와 연습 첫 응답 복원→결과1/1. 연속2클릭 이중 채점 없음. 390×844 미색/선택지 줄바꿈/세로 이동, 콘솔 error0.
- VERIFIED: 데이터 생성/전체 tsc/119테스트 통과(15:35,16.41초). 기존 인증1건 조건부 건너뜀. 변경 파일 lint 오류0·경고0, 기존 도구 모듈형식 경고 별도. Production export/HTML22·JSON8 경로 감사 통과.
- VERIFIED: 초기 저장 테스트 hook10초 초과의 원인 중 하나였던 엔진 후보 전수 선계산 제거. lib/quiz-engine.ts는 첫 동의어 선택지 생성 때1회 계산/재사용. 복원·채점에는 불필요한 계산 없음. 실제 데이터의 지연 생성/재사용 테스트 추가, 시간 제한/정답 검사를 완화하지 않았다. 테스트 데이터 최초 import는 기존 실제데이터 테스트처럼 수집 단계에 둔다.
- BLOCKED(실기기 연결 없음): iPhone Safari/Android·iOS Chrome 실제 터치/캐시 확인. 좁은 데스크톱 화면으로 대체 완료하지 않는다.
- NOT DONE: 숙어 전 범위/일반 단어 의미핵·뜻·해설·예문·sense별 유의어 검수. 파생어/어근/확인된 역사적 의미 변화와 추가 문항 유형은 실제 근거가 확보된 항목부터 별도 batch.
- NOT DONE: 학습 효과/지연된 새로운 문맥의 성취 측정. 해설 직후 연습 정답률을 실제 시험 점수 향상으로 주장하지 않는다.

## 기존 기능의 보존 근거

- 1.9 소스2dfc841 / Pages7df42fc / Actions34444876102 success. 본 문제풀이 마지막1세션의 실제 문제/선택지/위치/응답/입력 초안/힌트/플래시 공개 상태 복원. 완료/다른 요청/정본 변경 시 재사용하지 않음. 같은 범위 새 문제 버튼은 누적 성적을 지우지 않음.
- quiz-session.ts 검증/점수 복원→store.ts 공통 큐·실패 재시도·손상 원본 보존. 응답과 진행 기록을 같은 쓰기 요청에 포함하지만 저장소 원자성/여러 탭 병합까지 보장하지 않음.
- 로컬 Chrome1.9:10문제1정답9패스→오답9→통계10/1, 새로고침/이전 응답/중도 새 문제/입력 초안·힌트/플래시 복원 확인.2.0 전체 회귀에12개 중단 복원 테스트 포함.
- 1.8 소스159c8fd/fdd0556/6738f2c / Pages ea90d04: 병렬 북마크·시간 유실/실패 중 오답 부활/깨진 통계 덮어쓰기 수정. tests/ 탐색과 Metro 임시 Python 트리 제외, 단일 verify/빌드 감사, 결과→오답 목록 잘못된 복귀 수정.
- 정본38,163개, 숙어·표현3,731수록 행/소문자 표제어1,877개(연어·고유명사 포함). 전체 해설139개 뜻/218행은 검수 숙어139개라는 뜻이 아님. 구성요소 해설13표현. 미국식 허가 녹음17개, 나머지는 en-US 합성음.

## 남은 문제와 정확한 다음 행동

1. 정답 공개 전 노출 회귀 후보: 플래시카드 뒷면 뜻/동의어가 숨김 상태에서도 DOM 접근성 트리에 남는 것을 관찰했다. components/flip-card.tsx와 본 문풀의 실제 마운트 조건을 확인하고, 가림/뒤집기/세로 스크롤을 보존하는 최소 접근성 수정→재검증을 먼저 처리한다. 화면에 보인다는 뜻과 구분.
2. 다음 의미핵 batch: work out(기존 num42 포함 반복 항목)의 해결·계산/일이 풀림/운동 용법을 독립 사전2개로 먼저 구분. data/기존 composition를 대조하고 한 핵으로 무리하게 합칠 수 없으면 경계를 명시한다. 해당 표현 전체 연결 행의 core/예문/문항→두 UI→검증→공개 반영까지 닫고 다음 표현으로 이동.
3. 여러 탭 동시 기록 충돌 보호, 오답 전용 복습 세션 복원, 손상 기록의 사용자 백업/복구 도구 미완료. 읽기 불가 기록을 자동 삭제하지 않는다.
4. 개인별 오답 보기 생성/기기 간 적응형 기록 동기화/실제 미국식 허가 녹음 확대 미완료. Pages 배포를 별도 server/auth.ts의 서버 배포로 간주하지 않는다.
5. 편의 후보: 단어장 검색2행 상태의 '숙어·표현에서10문제'는 검색결과가 아닌 전체 선택범위 출제(라벨은 범위와 일치). 검색결과 한정 출제는 의미 변경을 확인할 후속 후보로 두고 현재 버그로 단정하지 않음.
6. 실제 모바일 Safari/Chrome 연결 시 버전/캐시/가림/뒤집기/세로 스크롤/이전·다음/재접속 검증. 지금은 실기기 미확인.

## 자동 재개와 복구

- ID voca-nexus / heartbeat / ACTIVE / 매시간 / 이 대화019fc31d-adea-7f83-b2c0-81d298e78fdd. 매회 새로 등록하지 않는다.
- 2026.09.10 매시간 신호의 실제 수신 확인(최종20:22 KST). 신호 수신과 실제 개발 완료는 다름.16:19~20:22 공백을 연속 코딩으로 보고하지 않음.
- 다음 실행: Git/status→이 상태→최근 변경→미완료 항목→관련 검사. 코드는1d6c4ac에 누적,2.0 재빌드/재배포 불필요.
- 수정 전 python scripts/hold-development-lock.py 대화형 실행, LOCK_ACQUIRED 후 작업. LOCK_BUSY이면 다른 실행을 방해하지 않음. 이번 실행의 잠금 session79613/PID19780은 종료 시 Enter 해제 대상으로, 다음 실행에서 재사용하지 않는다.
- 실제 PC·앱·프로젝트 접근이 필요. 앱 종료/절전/크레딧 소진 뒤 무인 복구는 미검증. 복구 시각이 있으면 그전 재시도 보류, 없으면 다음 주기. 추가 구매/API 전환 금지.
- 의미 있는 개선/중요 장애/필수 결정만 알림. 같은 전수 검사·같은 실패·낡은 버전 배포를 반복하지 않는다.

## 사용자 작업 보존

server/auth.ts, analysis/, build/, output/, pnpm-workspace.yaml, qa_claude/, scripts/analyze_exam_corpus.py, scripts/build_exam_analysis_queue.py, scripts/incremental_exam_corpus_update.mjs, scripts/incremental_exam_corpus_update.py, tmp/, vocab_project/는 수정·커밋·삭제하지 않았다. scripts/__pycache__/ 로컬 캐시는 커밋하지 않았다.
