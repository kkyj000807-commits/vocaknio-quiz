# VOCA NEXUS 현재 작업 상태

기준: 2026.09.14 04:45 KST. 이 파일은 단일 현재 상태다. 구조/명령은 DEVELOPMENT.md, 운영 원칙은 AI_WORK_RULES.md, 자동 재개는 AUTOMATION_RUNBOOK.md를 따른다. 과거 todo/대화/자동화의 1.8 후보 문구보다 최신 실제 Git·공개 상태가 우선한다.

## 현재 배포 — 2.1, 전체 로드맵은 부분 완료

- Production: https://kkyj000807-commits.github.io/vocaknio-quiz/
- 배포 전2.0 → 배포 후2.1. 앱 표시: 버전 2.1 · 최근 수정 2026.09.13 22:46 KST.
- 소스56b677e1c8d1236e2b74ff10a291061d93cac8cc, Pages7f2d4ba14d57640ffca53195b541f4c3322dcfb1. 이후 상태 문서만 추가 커밋될 수 있으며 앱 소스는 manifest의 SHA가 기준이다.
- GitHub Actions34760832596 성공, 실제 게시09.13 22:48:31 KST. HTTP/해시 확인09.13 23:42 KST. 긴 실행 공백을 개발시간으로 합산하지 않는다.
- manifest: version2.1 / dataVersion v1.4 / learningDataVersion2.1 / builtAt2026-09-13T13:46:00.630Z / sourceDirty=true. true는 보존한 server/auth.ts 미커밋 변경이 존재하기 때문이며 숨기지 않았다.
- 번들 entry-092214894ff3839d6bbc12cd8b9bd678.js / SHA256 3d78feb8b2784c41b43ea1a31e7b25d7b9fe13b1682913abd68813d2a2a81016.
- 공개 root/settings/wordbook/quiz HTTP200, release.json·번들·학습JSON8개가 최종 로컬 산출물과 일치.
- 공개 내장 브라우저09.14 04:44: 설정2.1/22:46/3테마 버튼, 홈 기본3모드/보조 학습 버튼 확인. 사용자 성적에 테스트 응답을 추가하지 않았다.
- Chrome 공개 확인은 마지막 시점 연결 불가. 로컬 Chrome 결과를 공개 Chrome 결과로 대신하지 않는다. 실제 Samsung Internet/모바일 Safari/Chrome도 미검증.
- 캐시: 검사한 공개 URL에서 최신2.1 확인. 로컬 Chrome의2.0→2.1 일반 새로고침/미색 이관 확인. 모든 기기의 이전 캐시 잔존이 해결됐다는 주장은 하지 않는다.
- 최종 산출물: C:\Users\USER\Documents\Codex\2026-08-03\realtime-voice-chat\work\vocanexus-production-2.1-20260913
- Pages worktree: 같은 work 아래 vocanexus-pages-2.1-20260913. 이전 해시 자산/학습JSON1.4~2.0은 삭제하지 않았다. 직전 안정 Pages be269b8(2.0) 보존.

## 최신 제품 계약

- 목표: 편입영어 독해·논리에서 처음 보는 문맥에 어휘/숙어를 적용해 점수를 얻는다. 기능 수/데이터 행 수를 성과로 대신하지 않는다.
- 새 지시는 유지/강화/교체/추가/재우선순위/보류/제외로 기존 명세에 통합한다. 최신 구체적 의도 우선, 기록/정답/원본/사용자 변경 보호와 검증 없는 완료 금지는 최상위.
- 증상→코드/데이터 경로→재현→원인→최소 수정. 한 batch를 끝까지 검증하고 다음으로 넘어간다. 무관한 전면 개편·새 라이브러리·별도 대화/보조 작업 금지.
- P0 정답/기록/데이터/사용 차단 → P1 매일 학습/문제 품질/모바일 → P2 적응형/sense/기출 환류 → P3 구조/자동화.
- word+sense+concept을 출제 경계로 삼는다. headword synonym이나 한국어 일부 일치를 같은 sense로 단정하지 않는다. 플래시카드/직접입력은 보조로 보존.
- 콘텐츠: 숙어→핵심어→동의어 밀집군→다의어→기출 오답 연결. candidate/cross-checked/reviewed/production 구분, 독립 사전 교차검수, 의미핵/쉬운 설명/확장/뉘앙스/예문/문맥 문제의 실제 품질 coverage 관리.
- 현대 개념 설명·기억용 연상·확인된 의미 변화·역사적 어원 구분. 무료 열람과 복제 허가는 다르다. 사전 정의/예문을 무단 대량 복제하거나 미검증 내용을 정답에 넣지 않는다.
- 내용 작업 전 .agents/skills/transfer-english-reasoning/SKILL.md와 두 references를 읽는다. 공개 강의 원칙과 앱의 독자 추론/효과 실측을 구분한다.

## 이번 batch — VERIFIED

- 재현: sanction496의 승인/제재가 한 뜻에 섞이고 동사 문항에 erratic/faddish/fickle(형용사)이 생성됨. getSynonymDetails의 headword fallback/뜻 결합과 배열 기반 채점이 원인 경로다.
- data/sense-questions.json: sanction/all but 2표현·4sense·4문항·기존10행. 각 문맥에 정답/3오답/이유/2사전 근거를 분리했다. Cambridge 검색 색인과 Collins 본문 대조; Cambridge 직접 페이지 접근 실패를 출처 메모에 명시했다.
- 새 production 상태는 출제 적격 데이터 상태이며 전체 품질 인증이 아니다. 내부 A등급은 AI 편집 검수 판단, 학습 효과의 증명이 아니다. 전체 기존 어휘를 A로 인증하지 않는다.
- 새 경로: 본·오답 공통 문맥/해설, 정답 ID 판정, 실제 sense/선택지 snapshot 복원. 후보/보류/C가 legacy fallback으로 우회하지 않게 검사한다.
- 결과 화면에서 sanction의 혼합 뜻/동의어를 다시 보여주던 경로도 두 문맥별 설명으로 수정. 응답 후 문맥이 아래로 이동하던 화면 흔들림 제거.
- 기본 화면 플래시카드/직접입력은 보조 학습 펼치기로 이동, 기능/라우트/옛 세션 호환 보존. 새 네 가지 기본 유형 전체나 자동 오늘학습을 구현한 것은 아니다.
- Light/Paper/Dark 전체 토큰·설정·DOM·CSS·초기 HTML 연결. v2 light→v3 paper, dark 유지, 신규light. 옛 설정 삭제 없이 공통 저장 큐 사용. 손상 테마는 자동 덮기 대신 안내하며 채점 저장을 막지 않는다.
- 웹 탭52px/아이콘21/라벨10, 끝padding48, 공통 본문max-width880. native inset 계산 보존.
- release manifest sourceCommit/sourceDirty/dataVersion/learningDataVersion/builtAt와 KST 동일 기준 시각, metadata/basepath audit 추가.

## 검증 근거와 범위

- 전체 verify09.13 01:50: 데이터 생성/계약·sense 매핑·전체tsc·138테스트 통과. 인증1개 조건부 skip.
- 테스트는 216개 seed/mode/item 조합, 유일 정답/선택지 역순/위조 답/근거·출처 누락/중복/C/보류/손상 복원 거절을 포함한다. 의미의 사실성과 오답의 그럴듯함은 테스트만으로 증명하지 않는다.
- 저장 검사 첫 hook가 대형JSON 최초 변환 때문에10초 초과한 회귀성 불안정을 수정: 실제 모듈 최초 로드를 수집 단계로 이동, 매 테스트 reset/reopen·모든 검사는 유지. 해당 hook624ms, timeout 확대/약화 없음.
- 변경 lint 오류0. 5경고(기존 미사용 import4, themeConfig default-member1), 도구 module-format 경고 별도. P0 추가 변경 lint 오류/경고0.
- Production export 및 복사 후 감사: HTML22, 학습JSON8, 참조 누락0, 잘못된 루트 자산 경로0, manifest pass. 빌드의 experimental basepath/오래된 Browserslist/NO_COLOR 경고는 남음.
- 실제 Windows Chrome 로컬: sanction 오답→새로고침(같은 문맥/선지/오답1)→결과→오답복습 authorize 더블클릭→결과1/1. all but12−2=10 문항 채점, 영어·한글 문맥 표시, 콘솔 error0.
- Chrome 로컬: 신규white, Dark/Paper 변경 후 일반 새로고침,2.0의 옛 light를 UI로 저장한 같은 origin을2.1로 교체→paper(#F5F0E6) 유지. 공개 사용자 저장소를 실험에 사용하지 않았다.
- Chrome viewport390×844: 탭52px/터치47.2px, 설정 마지막 링크 접근.800×1280 단어장 검색2행;1280×800 max-width880·펼친 마지막 해설/출처44px 버튼 접근;1440×900 통계 배치. 보조모드 펼치기/북마크 추가 확인.
- BLOCKED: 실제 Galaxy Tab Samsung Internet/Chrome·iPhone Safari 연결 없음, 강제 다크 ON/OFF·실제 터치·캐시 미검증. 최종 공개 확인 시 Chrome 연결도 없어 내장 브라우저만 사용. 모든 테마×모든 화면 전수 확인은 NOT DONE.

## 남은 우선순위 — 전체 작업은 부분 완료

1. NEXT / P0: 나머지 어휘의 headword/sense/POS/source 경계. 대표 다의어/동의어 밀집군/반의어/숙어/비슷한 한국어 번역별 재현 fixture를 확보하고, 현재 새4문항 밖 legacy 출제의 복수정답·뜻 겹침·품사 문제부터 수정한다. .p는 POS가 아니라 IPA임에 주의. 충분한 정답 근거/서로 겹치지 않는3오답/그럴듯한2오답이 없으면 안전한 비출제를 지원해야 한다.
2. P0/P2: 본/오답 기록은 여전히 headword번호 중심. 실패한 특정 sense를 다음 오답 문제로 유지하는 것은 NOT DONE. 기존 오답 번호/성적을 임의 변환하지 말고 additive 저장/복원 계약과 회귀 테스트부터 설계한다. 옛 중단 세션은 보존하며 자동 재채점하지 않는다.
3. P1: 자동 오늘학습 queue, 네 기본 유형(영한sense/영영관계/문맥/contrast) 전체 연결 미완료. 기존 세부 모드 보존. 모바일 실기기 검증과 랜덤 순서 안정성도 남음.
4. P1/P2: 단어장 검색 실측38163행/8검색×10 median14.97ms,p95 70.21ms. 북마크 state 변경 시 filteredVocab의 shuffle 재실행 코드 확인, 수정 보류. 새 검색엔진 도입 없이 순서 생명주기 분리부터 검증한다.
5. 콘텐츠: 반복 가능한 후보 생성→검수→생산 파이프라인 전체는 NOT DONE. 현재 좁은 schema/audit만 존재. 다음 내용 후보 work out(해결/계산·일이 풀림·운동)은 사전/sense 대조부터. 의미핵 전수 완료로 보고하지 않는다.
6. 오답 전용 중단 복원, 여러 탭 동시 기록 보호, 깨진 기록 사용자 백업/복구, 오답 원인 추론/sense mastery/학교별 기출 환류 미완료. 학습 큐를 우회한 AsyncStorage 쓰기 금지.
7. 플래시카드 숨긴 뜻이 DOM 접근성 트리에 남는 후보 관찰, 실제 마운트/aria 확인 필요. 시각적으로 답이 보인다고 단정하지 않는다.
8. P3: CI 자동 verify/build, 공통 swipe의 실익 있는 최소 추출, 오래된 PR1/2/3·claude/*의 main 미반영 가치 비교. 삭제/branch protection 변경 금지.

## 데이터 및 이전 안정 기능 보존

- 정본38163행. 숙어·표현3731행/소문자 표제어1877개(연어·고유명사 포함).
- 깊이 학습139sense/218행, 문맥 연습6표현/13문항/17행, 구성요소 해설13표현, 새 본문풀4문항/10행은 서로 다른 지표다.
- 기존 all but 의미핵1표현/2행과 문맥연습3문항 유지. 미국식 허가 녹음17개, 나머지en-US합성음.
- 1.9 본 문풀 마지막 세션 문제/보기/응답/이전위치/입력초안/힌트/플래시 상태 복원 유지. 완료/다른 요청/정본 변경 때 재사용하지 않음.
- 1.8의 공통 learningStorageQueue/persistLearningEntries와 실패 재시도/깨진 원본 보존 유지. 병렬 북마크 유실·오답 부활·오래된 값 덮기를 회귀 검사했다. 여러 탭 원자성까지 보장하지 않는다.
- 별도 server/auth.ts/서버 동기화 배포와 GitHub Pages를 혼동하지 않는다.

## 재개와 사용자 작업 보호

- 같은 main/같은 대화/heartbeat voca-nexus 매시간. 기존 예약을 매회 새로 만들지 않는다.09.14 04:43 KST까지 실제 신호 수신, 신호 수신≠지속 코딩. 절전/앱 종료/크레딧 소진 뒤 무인 복구는 미검증. 새 비용/API 전환 금지.
- 재개: Git/status→이 상태→최근 diff→NEXT P0→관련 검사.2.1 재빌드/재배포나 옛1.8 작업 반복 불필요.
- 기존 잠금 session79613/PID19780과 검증 서버는04:44 조회 시 종료돼 있었다. 상태 마감용 새 잠금 session60511/PID456 획득, 이 회차 종료 시 Enter 해제한다. 다음 회차는 새로 획득한다.
- 사용자 보존: server/auth.ts, analysis/, build/, output/, pnpm-workspace.yaml, qa_claude/, scripts/analyze_exam_corpus.py, scripts/build_exam_analysis_queue.py, scripts/incremental_exam_corpus_update.mjs, scripts/incremental_exam_corpus_update.py, tmp/, vocab_project/를 수정·커밋·삭제하지 않았다. scripts/__pycache__도 커밋하지 않음.
- 다음 실기기 확인 필요 외에 현재 사용자 인증/설정 행동은 요구하지 않는다.
