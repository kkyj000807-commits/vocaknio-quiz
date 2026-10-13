# FINETUNE 현행 스냅샷

## 2026-10-13 — 최신 재개 지점: 전체 후보 준비·빈 동의어 연결 보완, 배포 보류

중간 후보 `532c0de0`의 앱/데이터는 whole verify **523 PASS·1 SKIP / 타입 PASS**, 변경 파일 lint/security 통과했다. 이후 원자료 s 배열이 비어 있어도 유효한 OEWN 동의어가 있으면 단어장 버튼/칩이 나오게 보완했다. 사전 sense 동의어를 먼저 표시하고, 다른 원자료 관계는 대조 전 추가 영역으로 보존한다. 마지막 보완은 실제 corpus 관련 Vitest **31 PASS**, 동일 단위 회귀 native **9 PASS**, 후속 pipeline/동일 회귀 Vitest **16 PASS**, 변경 4파일 lint PASS다. **마지막 보완 후 whole type/verify는 아직 미검증**이며 523건을 최신 전체 성공으로 승격하지 않는다.

빌드 preflight exit75: 가용 물리 3,004MiB < 3,072MiB. 이후 가용 RAM은 727~2,083MiB로 변동했다. 새 출력은 생성하지 않았고 Production 출력·실제 브라우저·Pages 배포는 NOT_VERIFIED/BLOCKED다. 공개는 **1.0 / 2026.10.13 01:48:14 KST / source095ee969 / sourceDirty=false** 그대로다. 버전/시각만 새로 찍어 배포한 것으로 가장하지 않는다. 테스트용 mock/SSR/viewport 이벤트를 실기기 결과로 쓰지 않는다.

독립 대량 처리: 공식 OEWN 2025 JSON archive를 private cache에 확보해 승인 SHA `7d749f6e…4b51`과 일치 확인. 기존 Python importer의 `--reference-stage` 모드는 **public/assets를 쓰기 전에 반환**하며 private `analysis/qa/oewn-reference-stage-20261013.json`만 만든다. 전체 **13,347 표제어 / 38,163행 / 32,382 lexical sense / 24,507 공유 synset 클러스터**를 준비했고 13,523클러스터·8,099표제어에 원문 용례가 있었다. 원문 출처/CC BY 4.0/귀속·원본 ID·POS·sense/synset 참조를 보존했다. 2,993ms / own peak working set262,148,096bytes(약250MiB), 재실행228ms/NO_CHANGE/mtime 유지. 출력 경계 4사례·AST 검사 통과. **신규 의미/번역 검수0, production 변경0, 후보8,099를 실제 UI 연결2,099와 혼동 금지.** 후보가 여러 뜻/구문과 겹치면 한국어 뜻과의 연결·자연스러운 문장·번역/단서를 검수한 뒤 기존 export로 통합한다.

앱 입력/관계어 전수 감사의 최신 hash는 `124f0ea98f0b0398439de65e8f4448e9ce48c6b2cb4a555c8e5aa01119c5a8e7`. 원자료/구현/표시 경로까지 hash에 넣고 동일 입력은 NO_CHANGE다. 기존 예문 접근 가능 경로101→2,099표제어/243→6,573행, 간결한 개별 뜻437관계·1,281행, 미완료 관계어 뜻8,267건. private 전체 구조 queue13,262표제어와 새로운 사전 참고 후보13,347표제어 queue는 **다른 범위**이며 기존 검수 자료를 재생성/강등하는 숫자가 아니다.

main의 사용자 untracked 3.10 학습 JSON도 읽기 전용으로 확인했다: 152 export entries/92 unique senses, 기존 통합1.29의 entry ID 밖 신규0. 내용/권리의 신규 의미 검수가 아니며 자동 복사·stage하지 않았다. 중앙2027 DB 연결은 미확인/sync_required다. 기존 원본·학습 기록·MASTER·오답·저장키·모든 정답은 변경하지 않았다. OS 잠금33063/PID11832는 종료 Enter/LOCK_RELEASED 영수증으로 해제 확인한다.

**다음 실행:** 동일 통합 작업실의 저장된 후보에서 물리+commit 각각3GiB 이상을 확인하면 1worker whole verify/최종 lint/security → 깨끗한 해당 source SHA의 새 `audit-output*` 빌드/출력 감사 → 격리 브라우저의 단어장(4회귀 표본)/답·해설·오답·통계·복습·복원/viewport → 승인 Pages·공개 manifest·번들 확인. 버전1.0/내부1.29 유지. 후보 source만으로 배포 성공이라 하지 않는다. 그 다음 기존 검수 자료를 먼저 재사용해 `--reference-stage`의 같은 sense 예문·개별 한국어 뜻·문맥 해석을 batch로 채우며 실패/미검수 큐만 재개한다. supersede A (with B)/supplant A의 base lemma 연결은 아직 보류다.

## 2026-10-13 12:05 KST — 동의어·모바일·전 범위 기존 콘텐츠 연결 후보

기준 `11a6122a`, 통합 worktree 단독 OS 잠금 `33063/PID11832`. main `1bf27b98`와 사용자 dirty 파일은 읽기 전용으로 보존했다. 공개는 아직 `1.0 / 095ee969 / 01:48:14 KST`; 아래 변경은 빌드·격리 UI·공개 확인 전 후보다.

- 공통 RelationChips: `brag (자랑하다)` 형식, 5개 우선/더보기, exact와 ≈ near 구분. 개별 뜻이 없을 때 긴 표제어 정의를 복사하지 않는다. 긴 관계어 해설·원자료 대조 전 뜻은 별도 펼침으로 보존한다. 단어장 일반/검수 관계 표시를 같은 컴포넌트로 연결했다.
- 정보 순서: 한국어 핵심 뜻 → 관계어 → 영영 정의 → 영한 예문. 정답 전·뜻 가림 중 비노출 유지. active-recall/deep 층이 기본 사전 참고를 가리던 경로를 열고, 추가 예문·용법과 다른 사전 sense는 선택해서 볼 수 있다.
- 웹 루트의 항상 0인 Safe Area override 제거, 실제 inset을 탭에 한 번 반영(기본 52px 유지), visualViewport의 툴바/키보드 높이 반영과 pinch zoom 제외. SCROLL_END_PADDING 48 유지; 임의 대형 padding 없음. 실제 Safari/Samsung Internet/태블릿 검증은 NOT_VERIFIED다.
- OEWN lexical sense ID를 공통 synset ID처럼 비교하던 한국어 뜻 연결 오류 수정. 명시된 member 집합·품사·정의 일치와 원자료 뜻 단일성만 이용하며, 서로 다른 뜻을 합치거나 정답/ID를 바꾸지 않았다.

전수 집계: **13,347 고유 표제어 / 38,163 출현 행**. OEWN 정의 후보 11,611 표제어·34,726행, 사전 lexical sense ID 32,382개(검수 canonical 110개와 다른 단위). 기존 영어 예문이 하나라도 있는 표제어 2,099개; 영한 예문·문맥 단서 tuple 103개. 코드 경로상 단어장 예문 접근은 101→2,099 표제어, 243→6,573행. 새 창작/새 의미 검수는 0이며 UI/의미 품질 전수 완료를 뜻하지 않는다.

기존 자료 재사용 manifest: 3,397 표제어·9,819행, 영어 예문 2,023 표제어·6,405행, 사전 관계 8,769행, 간결한 개별 한국어 뜻 437관계·1,281행. OEWN 2025 CC BY 4.0/Princeton WordNet·OEWN Team attribution 유지. 원자료/공개 JSON을 중복 생성하지 않았다. 구조적 미완료 queue 13,262표제어와 관계어 뜻 검토 queue 8,267건을 private `analysis/qa/synonym-example-coverage-20261013.json`에 입력 해시·재개 키로 저장했다. 1.703초 전수 연결 감사, 동일 입력 재실행 NO_CHANGE/mtime 유지. 이는 의미 검수 생산성이 아니다.

| 범위 | 출현 행 | 정의 후보 행 | 기존 EN 예문 행 | 기존 영한 예문 행 | 짧은 관계어 뜻 연결 행 |
|---|---:|---:|---:|---:|---:|
| V101 | 4,028 | 3,666 | 733 | 62 | 135 |
| V201 | 4,016 | 3,749 | 769 | 36 | 160 |
| V301 | 4,854 | 4,716 | 950 | 20 | 159 |
| V401 | 3,965 | 3,527 | 605 | 34 | 113 |
| V501 | 5,888 | 4,333 | 755 | 58 | 139 |
| V502 | 10,127 | 9,810 | 1,891 | 27 | 431 |
| V601 | 2,935 | 2,855 | 449 | 5 | 89 |
| 부록 | 2,350 | 2,070 | 421 | 11 | 55 |

검증: whole verify exit0 / 타입 PASS / **523 PASS·1 SKIP**, 변경 22파일 ESLint PASS·0error/0warning, pnpm security:audit PASS(745 tracked+5 untracked/0 findings), 동일 assertions native 8 PASS. 첫 영향 검사 17실패는 펼침 UI 계약 16건과 특정 단어의 안전한 뜻 연결을 가정한 테스트 1건이었다. 기존 의미 보존 검사는 상세 열린 상태에 유지하고 별도로 기본 화면 비노출·순서를 검사했다. ESLint 512MiB 제한은 실제 V8 heap failure였으며 자원 회복 후 기존 기본 heap으로 실행하여 통과했다(한 fixture display-name 수정). 사용자 프로그램 종료/OS 설정/테스트 약화 없음.

회귀 표본: capricious 8행/기존 deep4행, boast9/deep3행. supersede A (with B)/supplant A를 포함한 표제어군은 각각6/10행이며 검수 deep/원자료 동의어가 없다. 기본 뜻은 보존하고, 해당 구문과 사전 base lemma의 sense 연결·짧은 번역·영한 예문 보강은 큐의 미완료다. 샘플 몇 개나 필드 존재를 전체 품질 완료로 승격하지 않는다.

다음: 깨끗한 소스 후보의 새 Production 빌드/감사 → 격리 단어장·문풀·복원·좁은 화면 확인 → 승인 Pages 공개 확인. 이후 큐를 source/sense별로 계속 처리한다. 기존 미검증 기출 268개 보류·SC11가능/1보류·저장키/MASTER/오답/원정답 유지. 최종판/99% 완료 아님.

## 2026-10-13 11:17 KST — A 예약 재개: 동일 후보, 자원 미회복으로 배포 보류

실제 heartbeat 수신 후 후보/원격 `64760e8c`, main `1bf27b98`, Pages `9e5a0ffb`, 공개 1.0/source095ee969/01:48:14KST/dirtyfalse/learningData1.29를 읽기 대조했다. 통합 작업실은 시작 시 clean이며 main 사용자 dirty 목록은 그대로다. `0639f9e9` 이후 차이는 checkpoint 문서뿐이고 코드·데이터 새 변경은 0건이다. 기존 targeted12PASS를 전체 PASS로 승격하지 않는다. 11:17:13 CIM 가용 RAM **493MiB(0.482GiB)**·commit **22.116GiB**, 실행 중 Vitest/tsc/Metro는 0개다. 전체 검사/빌드 각각 3GiB·영향 검사 768MiB에 미달하므로 이번 회차 검증·lint·생성·빌드·UI·배포는 **실행하지 않음(NOT_RUN_RESOURCE)**, 배포는 **BLOCKED**다. native384MiB는 허용 가능하지만 동일 입력의 기존 12PASS를 재실행하지 않는다(NOT_RUN_UNCHANGED_INPUT). 직전 lint134/verify75 미통과 상태를 유지한다. 이전 checkpoint는 각 Git commit과 외부 A-latest의 priorScheduledCheckpoints에 보존했다.

OS잠금85979/PID15184으로 이번 checkpoint 문서/외부A-latest만 저장한다. 코드/자료/기록 수정0, 새예약0, Pagespush0. B의원본경로130접근불가/Git10ecb45c별도계보11텍스트백업은외부 `2026-10-13-B-integrity.md`에서추적하며공식정답·권리미검증/현재기출출제0 경계를유지한다. B원자료감사/추출을A에서중복하지않는다. 실제 예약 신호 수신은 확인했으나 정확한2시간 주기/절전복구 성공을 입증한 것은 아니다. 다음은 영향검사768MiB 기준 회복 시관련검사, 전체릴리스는RAM과commit 각각3GiB 이상·다른heavy실행없음일 때1worker 기존lint→전체verify/security→새빈Production/감사→격리학습·공개확인. `lastPassedCommit`095ee969 유지, 해결된 P0 재작성·완료 batch 재처리 금지. 종료Enter/LOCK_RELEASED는도구영수증 확인.

## 2026-10-13 03:07 KST — 고효율 구조 감사 2건 수정, 배포 전 검증 대기

- `lib/vocab-definitions.ts`: `typeof null === object`로 잘못 승인한 응답이 성공 Promise에 캐시돼 재시도까지 실패하는 경로를 실제 코드로 재현했다. null/배열/root/그룹 header를 캐시 전에 검사하고 실패 cache eviction을 재사용한다. 고정 데이터 URL은 `no-cache` 재검증, 정상 페이지 내 동시 요청은 기존 cache로 1회만 수행한다. UI의 기존 다시 불러오기·정상 자료 보존 경로는 변경하지 않았다. 공개 서버에서 이 손상이 실제 발생했다고 단정하지 않는다.
- `scripts/audit-vocab-definitions.mjs`: 행마다 `Array.find`하던 이차 검색을 ID Map으로 바꿨다. 동일 정본38,163행 실측(동일256MiB heap/직렬): 시작→자식exit **10.144s → 0.301s**, OS maxRSS **125.383 → 124.781MiB**. 8그룹/상태/출처/포인터 감사 결과 동일. 첫 원본 행 우선 조회·누락/중복/잘못된 그룹 오류 기준 보존. 단일 전후 실행 결과이며 전체 앱 속도 개선 수치가 아니다.
- 검증: 수정 전 loader **2PASS/8FAIL**(처음 mock default 결함은 harness 수정 후 별도 구분); 최종 같은 native/Vitest 공유 assertions **12PASS/0FAIL**, 실제 loader의 isolated strict 타입검사0errors, 실제 전체 정의 데이터 감사PASS, Git보안742tracked/3untracked/findings0, 정본SHA `7eba20f388d04e9d7fb10edec635beac5dc7a6c726ef6e25d7daba4ce57908dd` 유지. 잘못된 응답 뒤 정상 재요청, 동시 중복 방지, unknown/missing pointer와 8종 감사 실패 fixture 포함. 타입 의존성은 격리 선언이므로 전체 타입검사를 대신하지 않는다.
- 미완료: `verify-project`는 RAM766MiB < focused768MiB에서exit75, 새 Vitest/전체 타입/Production/IAB 미검증. 관련 ESLint는 명시256MiB상한·PID17328에서V8_HEAP_LIMIT/exit134로 실패; raw stderr/개인 프로세스 정보는 공개 문서에 저장하지 않는다. 알려진 저RAM(현재435~651MiB)에서 전체 빌드나 같은 실패를 재시도하지 않았다. lint 상한 확대/OS설정/사용자프로그램 종료0.
- 공개 `release.json`03:07읽기 확인: 1.0/source095ee969/sourceDirty=false/01:48:14KST/learningData1.29 그대로. 이번 변경 미배포. source branch에 소유 파일만 저장하고 main dirty·학습기록·ID·원정답·자동화 보존. 신규 콘텐츠/의미검수0. 잠금60594/PID26876, 종료Enter/LOCK_RELEASED 도구확인.

다음: 추가 잠재문제 목록 탐색 종료. RAM/commit 조건이 바뀌면 관련 loader/Vitest·충분한 자원에서 기존 ESLint→전체verify→새Production·격리UI→공개확인. 동일 입력 감사 재실행 금지; 미통과 게이트 유지. 기존 대량 콘텐츠 작업의 미완료 후보 큐/입력 해시를 이어받되 의미·정답 게이트를 낮추지 않는다. 비공개 영수증 `analysis/qa/resource-runs/1791828159925-24304-native.json`(before), `1791828216470-5244-native.json`(after), 외부 `2026-10-13-structural-efficiency.md`.

## 2026-10-13 02:46 KST — 메모리 재발 방지 개발도구 적용, 공개판 유지

- 실제 원인 분리: 시작RAM1.448GiB/commit30.568GiB여유/CPU16. Vitest 기본CPU기준 pool과 per-worker 모듈·9.26MiB정본 재로딩은 병렬 증폭 요인이다. 사용자보고20workers를 실제다시 띄워OOM시키지 않고20상한/min fixture에서1~2clamp를 검사했다. 별개로 기존type1GiBheap 실패/실측1,386,835K·2GiB통과는V8상한 문제다. 현재테스트·Metro동시실행0이며Node기타/MCP를20테스트worker로 오인하지 않는다.
- 외부압박:백그라운드 최대프로세스 working set4.42→5.39GiB/private17.39→18.39GiB까지 증가, 가용RAM약0.46~1.45GiB로변동/commit약30GiB여유. 정확한프로세스명·PID·그룹별값은비공개QA보고서에보존했다. sharedworking-set합산을독점RAM사용량으로부르지않는다. 해당프로그램누수는미확정이며사용자프로그램종료/OS페이지파일/실행정책변경0.
- 구현: `resource-budget`+WindowsCIM측정/`monitored-process`를 pnpmtest·verify·Production·devMetro에 연결. 기존4Vitest env/빌드env/CLI상한을실측1~2로clamp, min1, heap자동확대없음. 다른heavy작업/측정실패/전체RAM·commit3GiB미만이면exit75;출력·학습DB생성금지. 실행단계별PID/종료코드/V8와native오류구분/표본private·working-set/프로세스·thread별OSpeak를비공개QA에기록한다.
- 처리량/메모리: Production텍스트64KiB청크·JSON그룹별처리·13파생출력NO_CHANGE/atomiccheckpoint. 같은1.0export감사결과 완전동일, OSpeak 약122→71MiB(약42%감소),0.73~0.93s→0.75~0.77s(일반적속도향상보증아님).13/13bytes·mtime보존/원자료변경0. 경계1byte누락과중첩token동시후보를수정해원래보안규칙/긴token/UTF8/reference회귀유지.
- PASS: 실제Vitest6파일19PASS(이후checkpoint/최종logger패치는Native동일10assertions로별도확인), 최종Node10PASS/264ms, 관련설정타입PASS/전체관련22파일lint0errors, 소스보안findings0, 현재export출력감사PASS/동일결과. Metroconfig실제로maxWorkers1 확인(서버시작없음),64MiB진단fixture PID31168 sampledprivate81MiB, 짧은Node테스트자식PID32372 OSpeak54.5MiB, Metroconfig PID27384 OSpeak140.3MiB. 코드7진단fixture PID28556는 COMMAND_FAILED로기록(P0/실제OOM아님).
- BLOCKED/NOT_VERIFIED: 변경후verify의데이터7단계PASS→전체type에서RAM1023MiB로exit75, ProductionRAM1006MiB→75/새출력폴더없음. 최종추가Vitest세트RAM748MiB로보류, devMetro최종527MiB로75/서버시작없음. 최신전체회귀·새Production빌드·실제2workerfull시험 미검증. 구판489PASS와 이번19PASS/Native10을혼동하지 않는다. 공개1.0/source095ee969/수정01:48:14유지, main/기존dirty/학습기록/모든원정답보존.

다음: 현행 자동화에서 자원 게이트를 통과할 때 최종추가 파일의 관련Vitest→전체verify→새빈빌드/감사. 같은저RAM환경에서강제재시도·heap확대하지 않는다. 상세는 [메모리 실행 계약](MEMORY_EXECUTION.md), 실측/private보고서는 `analysis/qa/resource-runs` 및 외부 `2026-10-13-memory-engineering.md`. 이번잠금81481/PID21448, 종료Enter/LOCK_RELEASED는도구영수증 확인.

## 2026-10-13 02:13 KST — 1.0 공개 업데이트 확인

이번 안정화 누적 후보는 실제 공개 배포까지 완료했다. **전체 콘텐츠99%·시험용 최종 안정판 완료는 아니다.** 아래 미배포/BLOCKED 표시는 해당 시점 이력이며 현재 릴리스 상태는 이 절을 기준으로 삼는다.

- 공개: https://kkyj000807-commits.github.io/vocaknio-quiz/ · 표시 **1.0 고정**, 수정 **2026.10.13 01:48:14 KST**, source `095ee9694821b602abc553a4b6fee99166d74ffc`, `sourceDirty=false`, dataVersion `v1.4`, learningDataVersion `1.29`. Pages commit `9e5a0ffbc2b4a36257af35330bf604383ebd3aa6`, 실제 Pages build `built`/오류없음(2026-10-12T17:08:10Z).
- 공개 번들 `entry-acfa34e2143e4295174107dd76981865.js`: 15,904,138bytes, SHA256 `cfb060d9dd31e422158255106ecf74e4e7ca286d91832d1e1ec191e1de2368cc`, 로컬 출력과 byte 동일. 공개 학습8·OEWN사전8 JSON 모두 source 내용/Git 배포 blob과 일치. 사전8개는 Git CRLF→LF(마지막 줄바꿈1개)만 달라 JSON·정규화 해시 동일; raw byte 동일이라고 보고하지 않는다.
- 최종 후보 `analysis/qa/production-1.0-20261013-0148`의 Production 빌드/출력 감사 PASS: HTML22/routes21, 누락참조0/보안결함0/학습헤더8 PASS/사전8/녹음17 출처·license 검사 PASS. source Git보안725tracked/0untracked/findings0. 전체 verify exit0 **489 PASS·1 SKIP**, 마지막92.01s. 전체 lint0errors/기존8warnings. 인증logout SKIP은 실제 서버 인증 검증이 아니다.
- 실제 격리 IAB:30문제 풀이6/30→정확한 뜻/유형1개 복습정답7/31→새로고침7/31. 최종 판본으로 전환 후31응답 유지. 별도 빈-origin에 백업파일 미리보기(6new/3identical/0conflict)→명시복원→7/31→재접속7/31. 실제 다운로드 백업31응답, 인증 제외. 공개 사용자 답안/MASTER/통계로 실험하지 않았다.
- IAB 320/1024/1280px × light/paper/dark9조합 가로이탈0·하단5탭 접근 확인. Windows QA 서버의273자 font 경로404는 확장경로 `\\?\` 실행으로200/356,840bytes·아이콘 표시 복구; OS설정 변경0, 제품 공개 장애로 오인하지 않는다. 실제 데스크톱Chrome에서 최종설정/음성선택 확인(Google US English 제공). 공개 IAB에서도1.0·수정시각·13,347표제어/38,163반복행·5/10/20/30·발음/로컬백업 안내 확인. 공개 화면 증빙은 비공개 `analysis/qa/public-1.0-20261013.jpg`.
- 실제 최종 SC:20요청→가능11 안내/실제1/11, 정답 전 영어지문·선지, 오답 후 방향/단서/정답·각오답 근거/한국어 풀이. 생성12 보존·모호1보류·eligible11·실제기출0. legacy268 원문/정답/선지/ID object 동일 보존, 현재 앱 번들에서 제외; 원정답을2/3번 패턴 때문에 바꾸지 않는다. 뜻문제 정답④→복습① 확인, 선지셔플 후 채점/복원 유지.
- 원본38,163행/고유표제어13,347·정본SHA 보존. OneDrive main `1bf27b9`와 사용자 dirty 그대로, 병합/강제push/삭제0. 소유 구현은 `finetune-exam-stable-1-0` branch에 보관·normal push. 기존 A2시간/ACTIVE 유지, 새자동화0. 이번은 수동 승인 릴리스이며 실제2시간 scheduler-trigger 성공으로 대체하지 않는다.

남은 범위: 전체 예문/의미99% 미달·신규 의미검수0, 실제 기출 원문/정답/공개권리 확보0, 공개 기존 기록 경고의 실제 원인 미확정, 비협력 구버전 탭/실제quota 통합 미검증, 실제 iPhone/iPad Safari·Galaxy Tab Samsung Internet/Chrome·키보드/회전/강제다크 미검증, 음성 청취/여성음색 품질 미검증. 설정의 깊이학습 `165개 뜻` 표시는 실제165export entries/97unique senses/230행이므로 다음 합산 변경에서 문구 정정한다; 이 잔여 문구만으로 즉시 재빌드하지 않는다.

다음: 같은 공개 source의 검사·빌드를 반복하지 않는다. 잠금/최신Git 확인 후 기존 licensed 예문을 sense+POS로 배치연결하고100개 실제 보강·의미검수 통과/보류/소요를 측정한다. 단순 구조1/100을 의미검수 생산량으로 사용하지 않는다. P0 재현은 저장기록 보호 우선으로 처리하며, 검증된 누적 변경만 기존2시간 체크포인트에 같은1.0/새KST로 배포한다. 복구는 이전 Pages `426e5fba947518d6eb6ded25c3f511e8ad6cf4ac`의 산출물을 새 normal commit으로 복원한다; force/reset/사용자저장 초기화 금지. 현재 release source095ee...와 이후 docs-only 보고 커밋은 구분한다.

## 2026-10-13 01:48 KST — 최종 후보 검증·실제 30문제 QA 통과

- 첫 Production 출력은 빌드 성공 후 감사가 FAIL했다. 실제 dataVersion `v1.4`를 숫자 표시 버전 규칙으로 검사하고, 외부 JSON의 녹음 출처를 JS literal에서 찾던 감사 오류였다. 기존 v접두 데이터 판본을 허용하되 경로 탈출은 거절하고, 공개 학습 JSON의 US 녹음17개 출처·URL·license·attribution을 검사하도록 고쳤다. 합성 출력의 잘못된 헤더/불명확 녹음 메타데이터는 계속 거절한다. 첫 출력은 수정된 감사에서 PASS했지만 최종 수정 코드를 넣어 새 출력으로 재빌드한다.
- 설정/단어장이 출현 행38,163을 단어 수로 표시하던 부분을 **고유 표제어13,347 / 수록38,163행(섹션 반복 포함)**으로 수정했다. 원본 행/뜻/ID/섹션/출제 수는 그대로다.
- 위 수정의 영향 검사51 PASS, 전체 verify 재실행 exit0: **56파일489 PASS·1 SKIP, 회귀92.01s**. 새 code6파일 lint0errors/2기존 Array 경고. 전체 범위 lint0errors/8기존경고. Python loopback QA 서버에 선택적 port 인수만 추가해 별도 빈-origin backup 복원 검증이 가능하다.
- 실제 IAB/localhost26729 첫 QA(output source4f4d0923):30문제 요청/실제30, 답안6정답24오답, 첫 오답→해설→새로고침에서 선지/응답/위치 보존·중복 집계0. 결과→통계6/30→exact `kor-choice`/white-elephant 의미 복습→정답→통계7/31, 우선순위 목록이 다음 취약 표현으로 바뀜. 정답은 원래④, 복습①로 표시되어 위치 고정 아님. 사용자 공개 기록 쓰기0. 이는 저장/출제 코드가 같은 첫 QA에서 검증한 결과이며, 최종 output의 표시/판본·reconnect도 별도 확인한다.

공개 배포는 아직 진행 전이다. 최종 source commit→새 빈 output→감사→같은 QA 데이터의 판본 전환 및 빈-origin backup→승인 Pages 공개 확인이 다음이다. 전체 콘텐츠 완비/예문 의미 검수/실기기 검증 완료로 확대하지 않는다.

## 2026-10-13 01:36 KST — 전체 검증 통과·릴리스 후보

사용자가 RAM 확보 완료를 기다리지 않고 현재 상태로 진행하라고 승인했다. 소유 잠금 세션77794/PID14024로 재개했다. Node1GiB 상한의 전체 verify는 타입 단계 heap OOM(exit1)이었고, 상한2GiB의 단독 타입 검사는 PASS(실측1,386,835K/12.18s). 이후 자원은 가용 RAM3.34GiB까지 변동했다. 프로세스 종료·페이징 변경 없이 전체 검증을 직렬 실행했다.

- **전체 PASS:** 현재 누적 패치로 `node scripts/verify-project.mjs` exit0, 데이터 감사/전체 타입, **56파일489테스트 PASS·1파일1테스트 SKIP**, 회귀85.57s. 모든 Vitest worker env1, Node heap2GiB. 첫 전체 회귀의2FAIL을 수정하고 다시 전체 실행해 통과했다. `auth.logout` SKIP은 실제 인증 서버 검증 완료가 아니다.
- **이번 추가 수정:** 일시 읽기 장애에도 이전에 검증된 baseline이 있는 새 변경은 대기값에 보존하고, fresh retry 시 외부 변경과 충돌하면 디스크/대기값 양쪽을 보존한다. 손상/미확인 baseline은 계속 차단한다. 테마의 마지막 실패 선택을 학습 journal과 별도로 명시 재시도한다. 테스트는 디스크 원문·대기 backup·충돌 경고를 함께 검사한다.
- **기출 공개 경계:** 보류 원문268개를 repository audit 모듈에 보존하면서 앱은 생성된 `assets/exam-release-catalog.json`과 `lib/exam-runtime.ts`만 참조한다. 현재 공개 후보 문항0. 브라우저용 bundling 테스트에서 보류 지문이 포함되지 않는지 확인한다. 원본 정답/선지/ID 변경0.
- **릴리스 입력:** 과거 로컬 QA `audit-output*/`를 Git 제외 범위에 명시해 그대로 보존한다. 사용자 dirty main은 그대로다. 검증된 소유 파일만 후보 source commit으로 묶고 새 빈 Production 출력/격리 UI/공개 배포를 확인한다. 이 시점에는 공개1.29 유지이며 build/UI/deploy 완료는 아직 아니다.

아래01:20 체크포인트의 RAM BLOCKED·whole NOT_VERIFIED는 당시 이력이며 위 전체 PASS로 대체한다. 콘텐츠 신규 예문·의미 검수0과 실제 기기/전체 커버리지 미완료 판정은 유지한다.

## 2026-10-13 01:20 KST — 통합 구현·부분 검증, 미배포

전체 러프 완성·99% 품질·최종 안정판 완료가 아니다. [과거 본문 전체](history/WORKING_CONTEXT-through-2026-10-13.md)는 보존했으며 필요한 결정만 검색한다. 최신 사용자 지시 → 이 스냅샷 → AI_WORK_RULES/관련 skill 순서다.

- 작업실: `C:/Users/USER/.codex/worktrees/finetune-audit-trial/편입대비 올인원앱 수저용ㅇ`, detached base `1bf27b98041a302c742c53f9beb2c39c2c1b411c`. 소유가 확인된 누적 미커밋 패치를 보존해 재개한다. OneDrive main은 읽기 전용, 자동 복사/stage/reset 금지.
- 공개 재확인: **1.29 / 2026.10.09 09:58 KST / source 34aa87eb55f0aae9c1569cff77c9f54d3b9695fb / sourceDirty=true**. URL `https://kkyj000807-commits.github.io/vocaknio-quiz/`. 이번 source commit/push/merge/배포 0.
- 승인 후보 표시 버전 **1.0 고정**, 내부 `release.config.version=1.29`는 데이터/캐시 호환 경로로 유지. 새 배포는 KST 시각·source SHA·builtAt으로 구분한다.
- 기존 A `FINETUNE A · 2시간 안정화·배포`를 목적 도구로 **2시간/ACTIVE/같은 대화** 실제 수정·저장 확인. B/C/D와 PAUSED 예약 보존, 새 예약 0. 새 주기의 실제 트리거/배포는 미확인. 시간표 때문에 검사 실패판을 배포하지 않는다. 외부 `C:/Users/USER/.codex/automation-audits/finetune/{POLICY.md,REGISTRY.md,A-latest.json,findings.json}`에 운영 기록을 남긴다.

## 실제 수정·보존

1. **저장:** disk baseline/pending 분리와 fresh 충돌 검사. 기존 큐에 additive `vocaknio_learning_write_journal_v1`으로 부분 다중 키 쓰기를 일치할 때만 복구. 외부 변경/손상은 보존·차단, 이벤트 재실행 없음. 기존 북마크 덮어쓰기 2 FAIL→PASS.
2. **과거 세션:** `parseStoredQuizSession`은 저장된 구조·정답 일관성, 엄격한 `parseQuizSession`은 현재 출제/채점/재개를 담당. stale 하나가 무관한 학습 저장까지 손상으로 차단하지 않는다. UI에서 원본 보관 후 새 문제 시작을 명시 선택.
3. **세션 경합:** additive `vocaknio_problem_session_archive_v1`에 이전 raw bytes를 보관한 뒤 같은 journal로 교체. 다른 탭 답안이 active 세션을 덮지 않고 보관/1회 집계. 같은 ID의 늦은 snapshot은 선행 답안을 지우지 않는다. 큐 대기 중 UI 객체 변경으로 검증값과 다른 값이 저장되는 새 회귀는 2 FAIL→detached snapshot 수정→12/12 PASS.
4. **백업:** 학습 키 allowlist/검사·미리보기·빈 저장소에만 명시 복원. 인증 제외, 충돌 자동 합산 없음. 과거 backup에서 새 archive 키만 optional; core 누락은 거절. 공개 기존 기록 경고의 원인을 이 결함이라고 확정하지 않는다.
5. **출제 차단:** legacy 기출268(171 blocked/97 unverified) 원문·정답·ID 보존, eligible0. 미상학교91 추정 배정 없음. SC `sc-condition-grant-v1`은 일정 수립→승인 전 사용 추론이 불명확하여 reviewHold만 추가. 생성12 유지/eligible11/기출0. 원래 정답 변경·문항 복제 없음.
6. **콘텐츠:** canonical backfill에서 EN·KO·cue를 같은 출처 tuple로 선택하고 번역을 필수에 포함. 다른 예문의 조각을 섞지 않음. 기존110개 본문 hash 유지, provenance/상속검수/이번 자동검사 구분. 새 의미 검수·창작 예문0.
7. **릴리스:** 생성기 이후 Git 상태를 확인하고 untracked/staged도 sourceDirty에 포함. 검증→소유 source commit→정확 SHA 새 빌드→공개 확인. 사용자 dirty 삭제로 clean 표시하지 않는다.

기존 누적 패치도 보존: 5/10/20/30, 학교 조회 정규화/선지 셔플, 미국 영어 음성 우선순위·선택 설정, EN/KO 예문 계약, 독립 해설 로더/재시도, 한국어 뜻 잘림 해제, 명시적 안전 한국어 문제 대체, 서버 미설정 동기화 안내 차단, 인증 오류 비식별화. 실제 화면/실기기/음성 청취 검증은 남음.

## 분모·실측

| 계층 | 수량 | 제한 |
|---|---:|---|
| 중복 제거 표제어 | **13,347** | 정규화된 고유 표제어; 원철자13,349와 구분 |
| 출현 행/고유ID | 38,163 / 38,163 | 섹션·부록의 의도된 반복 관계 보존 |
| 영어·한국어 필드 존재 | 38,163 / 38,163 | 의미 검수율이 아님 |
| OEWN 연결 행 | 34,726 | 단일11,706/다의22,783/alias237; 미매칭3,437 |
| canonical | 110 sense / 253행 | COMPLETE92/NEEDS_REVIEW18 |
| 깊이 학습 export | 165 entries / 97 sense / 230행 | 반복 export와 고유 sense 구분 |
| OEWN 정의 출제 | 4,114 sense / 11,360행 | EN예문 있음2,023 sense/6,405행 |

정본 SHA256 `7eba20f388d04e9d7fb10edec635beac5dc7a6c726ef6e25d7daba4ce57908dd` 보존. 구조 측정 input hash `a8d12da188edfc2a6f5d0df090b176b3794ee6561eca51888c2758eb1e91c15e`: 전체 표제어 검사753ms, 표본 단일후보34/다의어33/숙어·구문33. 엄격한 기본-content 구조충족1/100·보류99/100, **새 의미 검수0**. 동일 입력 재실행 NO_CHANGE(exit0).

자료·소비 경로 대조상 EN예문 하나 이상 표제어2,099/13,347, EN·KO·cue tuple 하나 이상103/13,347. 모든 sense 완비·실제 브라우저 표시 성공이 아니다. 포인터 불일치0/중복 row ID0; 미연결 표제어도 분모 유지. 표본/이유 큐는 `analysis/qa/content-throughput-20261013.json`(비공개 QA). 전체 의미 검수 속도가 미측정이라 완료일은 아직 산출 불가. 구조검사 속도를 검수 생산량으로 보고하지 않는다.

## 검사와 한계

- PASS: 관련 Vitest **22파일/135테스트**, 1worker, 8.95s(exit0). 실제 store/parser/journal + 격리 fixture와 mock UI. full corpus/실제 브라우저 대신이 아님.
- PASS: 관련12파일 ESLint 오류0/경고0(기존 Node module-type 도구 안내 별도). 소스 보안 검사의 정확한 수는 외부 최신 체크포인트 참조. 새 Production 감사는 아님.
- 부분: 전문4스킬·짧은 진입/조건부 참조와 독립5시나리오 라우팅 대조. 실제 사용은 저장 결함 수정과100후보 구조측정/NO_CHANGE. 신규100예문 보강·모바일·배포 인수 완료로 표시하지 않음. Python skill validator는 PyYAML 미설치로 BLOCKED, 설치하지 않음. 설치된 Node YAML로4개 frontmatter 대체 검사 PASS. 접근 불가능한 다른 대화·세션 원문은 읽었다고 가정하지 않음.
- BLOCKED: 시스템 RAM 약1.6GiB/총15.82GiB. 전체 verify/type/대형 통합/Production은 RAM·commit 각각3GiB 회복 전 OOM 재시도 금지. VRAM 진단 아님. 사용자는 미사용 앱을 닫고 알리기로 응답했으며 완료 확인 전이다.
- NOT_VERIFIED: 새 후보 실제30문제/backup/여러 탭, 공개 경고 원인, 실기기 Safari/Chrome/Samsung Internet·회전·강제다크·키보드, 전체 의미·권리 검수, 중앙DB 동기화. 과거 baseline358 PASS는 현재 dirty 패치 통과가 아님.

## 정확한 다음 행동

1. 잠금·main dirty·작업실 상태 대조. 이번 잠금78829/PID31664, 종료 Enter/LOCK_RELEASED 영수증은 도구 출력. 다음 실행은 재획득하며 과거 PID 소유를 가정하지 않는다.
2. RAM/commit 각각3GiB 확보 후 모든 VITEST worker env=1로 `node scripts/verify-project.mjs`, 관련 lint/security 직렬. 실패 수정→영향 검사→통합.
3. 소유 candidate commit→`FINETUNE_BUILD_MAX_WORKERS=1` 새 빈 QA 출력→출력 감사→격리 localhost 답/해설/오답/통계/정확유형복습/재접속·backup·30문제 검증. 공개 사용자 기록에 시험 답안 금지.
4. 게이트 통과 후보만 승인 Pages 배포, 공개1.0/KST/source/번들·데이터/UI 일치 확인. 실패/변경 없음이면 2시간이어도 억지 재배포 없음.
5. 기존 licensed 자료 재사용으로 전체 기본 coverage 우선. 실제100개 보강·의미 검수 시간/통과/보류를 측정한 뒤 완료일 산출. 이미 완료된110canonical이나 batch 재생성 금지.

main dirty 보존: `public/data/vocab-learning/1.4/{v101,v201,v301,v501}.json`, `server/auth.ts`, 미추적 `pnpm-workspace.yaml`, `public/data/vocab-learning/3.10/`, `scripts/__pycache__/`, corpus 분석·증분 스크립트, `vocab_project/`. 소유 불명 변경은 덮어쓰지 않는다.
