# VOCA NEXUS 현재 작업 상태

기준: 2026.09.26 19:20 KST. 이 파일은 단일 현재 상태다. 구조/명령은 DEVELOPMENT.md, 운영 원칙은 AI_WORK_RULES.md, 자동 재개는 AUTOMATION_RUNBOOK.md를 따른다. 과거 todo/대화/자동화의 1.8 후보 문구보다 최신 실제 Git·공개 상태가 우선한다.

## 현재 배포 — 3.1, 전체 로드맵은 부분 완료

- Production: https://kkyj000807-commits.github.io/vocaknio-quiz/
- 배포 전3.0 → 배포 후3.1. 앱 표시: 버전 3.1 · 최근 수정 2026.09.25 00:46 KST. 공개 게시·정합성 확인은 00:50 KST다.
- 앱 소스27bcba3db4634a54378573bd23980ef4df39b0a3 / Pages5f8a6b86a5a5876f418c57c050fa6a59b4fa33fe. 이후 상태 문서 커밋과 앱 소스 SHA는 구분한다.
- GitHub Pages build `built`. release.json sourceCommit 일치, sourceDirty=true는 보존한 server/auth.ts 때문에 표시. dataVersion v1.4 / learningDataVersion3.1 / builtAt2026-09-24T15:46:57.186Z.
- 번들 entry-e142647e05a45b9d6a23cc3da84bf2cd.js / SHA256 E812FF4B4CF90FD6736887903700D58375F3749266F51C2B541156A7B782BC05.
- 공개 root·quiz·신규 번들·3.1 학습 JSON이 HTTP200이며 release.json3.1, sourceCommit, 번들 참조를 확인했다. 공개 번들에 `wrap-up:finish-activity`와 간결 정의가 포함된 것도 확인했다. 공개 문제를 풀어 사용자 저장기록을 만들지는 않았다.
- 실제 iPhone Safari/Galaxy Tab Samsung Internet/모바일 Chrome 및 모든 기기 캐시는 미검증. in-app browser 결과를 실기기 검증으로 대신하지 않는다.
- 산출물: C:/Users/USER/AppData/Local/Temp/voca-3.1-20260925-004656
- Pages 임시 worktree는 배포·감사 후 제거했다. 이전 해시 자산/학습JSON을 삭제하지 않았고 직전 안정 Pages63ed9d8(3.0)을 보존했다.

## 최신 제품 계약

- 목표: 편입영어 독해·논리에서 처음 보는 문맥에 어휘/숙어를 적용해 점수를 얻는다. 기능 수/데이터 행 수를 성과로 대신하지 않는다.
- 새 지시는 유지/강화/교체/추가/재우선순위/보류/제외로 기존 명세에 통합한다. 최신 구체적 의도 우선, 기록/정답/원본/사용자 변경 보호와 검증 없는 완료 금지는 최상위.
- 증상→코드/데이터 경로→재현→원인→최소 수정. 한 batch를 끝까지 검증하고 다음으로 넘어간다. 무관한 전면 개편·새 라이브러리·별도 대화/보조 작업 금지.
- P0 정답/기록/데이터/사용 차단 → P1 매일 학습/문제 품질/모바일 → P2 적응형/sense/기출 환류 → P3 구조/자동화.
- word+sense+concept을 출제 경계로 삼는다. headword synonym이나 한국어 일부 일치를 같은 sense로 단정하지 않는다. 플래시카드/직접입력은 보조로 보존.
- 콘텐츠: 숙어→핵심어→동의어 밀집군→다의어→기출 오답 연결. candidate/cross-checked/reviewed/production 구분, 독립 사전 교차검수, 의미핵/쉬운 설명/확장/뉘앙스/예문/문맥 문제의 실제 품질 coverage 관리.
- 현대 개념 설명·기억용 연상·확인된 의미 변화·역사적 어원 구분. 무료 열람과 복제 허가는 다르다. 사전 정의/예문을 무단 대량 복제하거나 미검증 내용을 정답에 넣지 않는다.
- 내용 작업 전 .agents/skills/transfer-english-reasoning/SKILL.md와 두 references를 읽는다. 공개 강의 원칙과 앱의 독자 추론/효과 실측을 구분한다.
- 편입 관련 작업은 docs/MASTER_DB_SYNC_RULES.md를 따른다. 이 저장소에서 중앙 `2027 편입 마스터 DB`의 실제 위치·마지막 동기화 시점은 아직 확인되지 않았으므로, 현재 앱 정본을 중앙 DB와 동기화 완료했다고 간주하지 않는다(`sync_required`).

## 현재 batch — 검수 숙어 동의 표현 17sense backfill PARTIAL VERIFIED / 미배포

- Source main `40da261f79dcd79cbde9ae60872c81e0bd5f32a9`까지 `capitalize on`, `carry out`, `delve into`, `look after`, `put up with`, `at stake`, `to boot`, `by the same token`, `a case in point`, `clamp down on`, `crack down on`, `cut the ground from under someone`, `put A at ease`, `on the verge of`, `pull the rug from under someone`, `release - from house arrest`, `There is more than one way to skin a cat`의 공란을 독립 사전·thesaurus 본문으로 다시 검수했다. 공개 Pages는 계속 3.1이며 이 미완료 backfill batch는 배포하지 않았다.
- `capitalize on`은 실제 대체 가능한 `take advantage of`를 exact로, 문맥·이익 함의가 더 좁은 `benefit from`/`profit from`을 near로 보존했다. `carry out`의 `perform`/`execute`/`implement`와 `delve into`의 `investigate`/`look into`/`explore`도 대상·결합 범위가 완전히 같지 않아 near로 제한했다. headword의 다른 sense나 한국어 뜻 유사성으로 관계를 확장하지 않았다.
- `look after`는 `take care of`만 exact로 두고 `care for`/`tend`는 돌봄 대상·구문 범위가 다른 near로, `put up with`는 `tolerate`만 exact로 두고 `endure`/`bear`는 지속·고통 초점이 다른 near로 저장했다. `at stake`와 `at risk`도 결과에 걸린 가치라는 초점 차이를 보존해 near로만 저장했다.
- `to boot`는 추가의 연결 기능이 같은 `in addition`/`as well`/`besides`, `by the same token`은 같은 근거를 재적용하는 `for the same reason`, `a case in point`는 논점을 직접 보여 주는 `a relevant example`/`a pertinent example`만 exact로 연결했다. 일반적인 관련어·반대 연결어·headword의 다른 뜻은 넣지 않았다.
- `clamp down on`과 `crack down on`은 기존 Oxford·Collins 정의와 상호 대조 설명상 엄격한 단속 문맥에서 실제 치환 가능해 서로 exact로 연결했다. `cut the ground from under someone`은 주장·계획의 기반을 약화시키는 `undermine`과 핵심은 겹치지만 문형·구체성이 달라 near로만 저장했다.
- `put A at ease`는 불안 완화가 겹치지만 자신감·편안함 전체를 항상 대체하지 않는 `reassure`, `pull the rug from under someone`은 갑작스러움이 약한 설명형 `withdraw support from`을 near로 제한했다. `on the verge of`는 동일한 직전 상태를 나타내는 `on the brink of`/`on the point of`를 exact로 연결했다.
- `release - from house arrest`는 같은 사건 구조를 보존하는 `free from house arrest`, `There is more than one way to skin a cat`은 Oxford·Collins가 공통 확인한 의미를 압축한 `there are several ways to achieve something`을 exact 설명형 paraphrase로 연결했다. 일반 `release`·`skin`의 다른 sense는 가져오지 않았다.
- Oxford/Collins의 기존 정의 근거에 Collins `capitalize on` 및 Merriam-Webster Thesaurus `carry out`, `inquire into` 관계 근거를 추가했다. 무료 사전 문구를 앱 정의로 복제하지 않고 기존 자체 편집 정의와 source URL을 유지했다.
- Open English WordNet 2025 공식 archive의 같은 synset 구성원을 40개 허가 원문 sense manifest에 함께 고정했다. build는 표제어가 공식 synset 구성원인지 확인하고, 해당 synset의 다른 표제어만 exact synonym으로 가져온다. 다른 sense·headword fallback·한국어 뜻 유사성으로 관계를 확장하지 않는다.
- 40sense 중27sense에 동일 synset의 대체 표제어가 존재해 실제 learning JSON→canonical 산출물까지 연결됐다. 예: `capricious`→`impulsive/whimsical`, `vie`→`compete/contend`, `serene`→`calm/unagitated/tranquil`. 나머지13sense는 OEWN 해당 synset에 대체 표제어가 없지만, 다른 독립 출처 검토 전에는 `VERIFIED_NO_DATA`로 확정하지 않았다.
- 추가 원인: `abide by`, `put the cart before the horse`, `take for granted`, `teem with`, `work out`, `wrap up`은 같은 원본 occurrence에 상세 검수 sense가 이미 있는데, 과거 학습용 `:primary` aggregate 6개도 별도 canonical sense로 집계됐다. 특히 `work out`과 `take for granted`의 aggregate는 서로 다른 여러 뜻을 다시 합쳐 sense-first 계약을 위반하고 빈 동의어 6건을 허위로 늘렸다.
- backfill이 동일 표제어·동일 item 집합의 검수 sense를 발견하면 vocab-learning 전용 aggregate primary를 canonical 산출물에서 제외하고 `supersededAggregates`에 원본 ID·대체 sense·이유를 보존한다. 원천 learning JSON과 사용자 기록은 삭제·변환하지 않았다.
- 정제 후 canonical denominator는97sense다. 필드 공란은 영영정의0/한국어0/문맥0/예문0/예문해설0/구별메모0/출처0, 동의어51→34이다. 상태는 COMPLETE46→63 / NEEDS_REVIEW51→34 / VERIFIED_NO_DATA0 / FAILED0 / PENDING0이다. 원본38,163행/고유표제어13,347개, canonical 연결230행/미매핑37,933행은 변하지 않았다.
- `data/vocab-learning/oewn-2025-definition-manifest.json`이 공식 archive SHA-256, sense별 정의 hash, 동일 synset 구성원을 보존한다. `scripts/build-vocab-learning-v1.4.mjs`와 회귀 테스트가 public learning JSON의 exact synonym 목록이 manifest와 정확히 일치하는지 검사한다.
- VERIFIED: learning/canonical backfill을 실제 재실행해 asset→public JSON까지 동일하게 갱신했다. targeted 2파일15테스트, 전체 TypeScript·데이터 감사·25파일198테스트 통과(인증1skip), 변경 lint 오류0(기존 module-format 경고만 존재). 열일곱 sense의 COMPLETE 상태·exact/near 분리·공란 없음과 공개 데이터 일치를 회귀 검사했다.
- NOT DONE: 전체38,163행 canonical sense 이관과 필수 필드 보강은 완료가 아니다. 동의어34sense와 미매핑37,933행이 남아 있어 전체 완료/coverage100%라고 하지 않는다. 공개 Pages 배포와 실제 Safari/Chrome/Samsung Internet 검증도 하지 않았다.
- NEXT/P0: NEEDS_REVIEW34개를 숙어 우선으로 다른 허가·검증 출처와 sense 경계에 따라 검수하고, 실제 부재가 확인된 경우에만 VERIFIED_NO_DATA로 전환한다. 미매핑37,933행은 숙어·오답·고빈도 순으로 안전한 canonical mapping batch를 만든다. 새 UI/영영 문제 섹션은 공란 작업보다 앞서지 않는다.

## 직전 batch — canonical sense 학습상태·우선출제·선화 힌트 파일럿 VERIFIED / 미배포

- Source main `784a63c`는 origin/main에 push됐다. 공개 Pages는 계속 3.1이며 이번 batch는 아직 배포하지 않았다.
- canonical target을 `senseId` 우선으로 만들고, 아직 검수 sense가 없는 legacy 행은 `표현+표시 뜻`이 완전히 같은 occurrence만 같은 target으로 묶었다. 같은 표현의 다른 뜻은 합치지 않는다. 실제 `jury foreman` 중복 두 행은 한 target, `take for granted` 두 sense는 별도 target으로 검증했다.
- 상태 `NEW/ACTIVE/WEAK/MASTERED/RELEARNING`과 이벤트 `correct/wrong/unknown/confused/hint/mastered/relearning/image_used/image_helped`를 기존 `learningStorageQueue`에 연결했다. 기존 `vocaknio_mastered`는 원본을 보존하면서 안전한 단일-sense 행만 한 번 이관한다.
- MASTERED target은 일반 출제 대상에서 빠지지만 전체 어휘·관계 자료에서 삭제하지 않아 다른 문제의 참고/오답 자료로 남는다. 이후 실패하면 해당 sense만 RELEARNING으로 돌아오며 WEAK/RELEARNING은 적응형 출제의 긴급 lane으로 우선된다.
- 단어장·오답 목록의 마스터/다시 학습 조작, 일반/오답 문제의 canonical 이벤트·힌트·응답시간 기록을 연결했다. 여러 sense가 한 카드에 있는 경우 전체를 한 번에 마스터하지 않는다.
- 선화 파일럿은 production sense 2개(`jury foreman`, `put the cart before the horse`)에만 연결했다. 정답 전 자동 노출하지 않고 사용자가 `선화 힌트 보기`를 눌러야 보이며 사용/도움 이벤트가 sense에 기록된다.
- VERIFIED: `pnpm --ignore-workspace verify`의 데이터/sense/active-recall 감사·TypeScript·24파일188테스트 통과(인증1skip), 변경 파일 ESLint 오류·경고0, diff 공백 검사, Production 3.1 로컬 build audit HTML22/학습JSON8/참조누락0/루트자산0. 새 SVG 두 개와 `선화 힌트 보기`가 번들/산출물에 포함됐다. 로컬 production 산출물을 in-app browser에서 열어 실제 `jury foreman` 문맥 문항→힌트 버튼→선화 노출→정답 후 EN/KR/관계 분리까지 확인했다. 이는 실제 iPhone/Galaxy Tab/Safari/Chrome 검증이 아니며 공개 배포도 미수행이다.
- NOT DONE/P0: 전체38,163행의 canonical sense 이관, 공통 마스터 DB·기출 프로젝트 동기화, 학습대상 sense 영영정의100%는 완료되지 않았다. 현재 production active-recall coverage는 11sense/14행(정의14·concise14·예문14·영영문제14)뿐이다. 미검수 legacy synonym을 영영 정답 근거로 자동 승격하지 않는다.
- NEXT: 검증된 definition denominator와 실패 상태를 먼저 전수 집계한 뒤, 누락 데이터를 source→sense match→DB/write→정적 export→UI까지 한 vertical slice로 보강한다. 100%가 되기 전에는 전체 영영정의 완료라고 보고하지 않는다.

## 직전 batch — `wrap up` 업무 마무리 sense·두 정본행 VERIFIED / 3.1 공개 확인

- 기존 `idiom-corrections`의 Oxford·Collins 독립 대조와 `expression-composition`의 결합 해설을 재사용했다. `JBKROW000016`과 `JBKROW004042`를 `일·회의의 남은 부분을 정리해 마무리함` 한 production sense로 묶었다.
- 따뜻하게 감싸기·물건 포장하기 sense는 섞지 않았다. 자체 concise/full 정의·예문·정의/문맥 prompt를 추가하고 near synonym은 `bring to a close`, `finish up`으로 제한했다. `sum up`은 요약, `put off`는 연기, `set up`은 준비라는 반례를 오답 이유에 고정했다. 한국어는 정답 전 단서로 노출하지 않는다.
- VERIFIED: active-recall 11sense/14행/정의14/concise14/예문14/sense-safe 관계14/영영문제 가능14/failure0. targeted15테스트, 전체 TypeScript·data/sense 감사·22파일175테스트 통과(인증1skip), 변경 TS lint 오류0(기존 같은 테스트 파일 경고3), diff 공백 검사. Production3.1 build audit HTML22/학습JSON8/참조누락0/루트자산0. 공개 release·bundle SHA·sense 문자열을 확인했다.
- NOT VERIFIED: 실제 문제를 클릭해 채점·해설 화면을 확인하지 않았고, iPhone Safari/Galaxy Tab Samsung Internet/모바일 Chrome 실기기 확인과 학습효과는 미완료다.
- NEXT: active-recall 전체 denominator/backfill보다 먼저, 명확한 기존 독립 검수 근거가 있는 다음 숙어 한 sense를 같은 source→예문→정의/문맥 문제→UI vertical slice로 닫는다. 근거가 부족하면 production으로 승격하지 않는다.

## 직전 batch — `teem with` 한 sense·두 정본행 VERIFIED / 3.0 공개 확인

- 기존 `idiom-corrections`의 Oxford·Collins 독립 대조와 기존 구성 해설을 재사용했다. `JBKROW000005`와 `JBKROW003863`을 `많은 사람·생물·활동적인 것들이 가득함` 한 production sense로 묶었고, 단순히 물건으로 차 있는 `be full of`보다 생동감 있는 군집 뉘앙스를 정의와 문맥에 반영했다.
- 자체 concise/full 정의·예문·정의/문맥 prompt를 추가했다. near synonym은 `be full of`, `abound with`, 오답은 `team up with`(협력하다), `trickle into`(조금씩 흘러들다), `clear out`(비우다)로 역할을 분리했다. 한국어는 정답 전 단서로 노출하지 않는다.
- VERIFIED: active-recall 10sense/12행/정의12/concise12/예문12/sense-safe 관계12/영영문제 가능12/failure0. targeted22테스트, 전체 TypeScript·data/sense 감사·22파일173테스트 통과(인증1skip), diff 공백 검사. Production3.0 build audit HTML22/학습JSON8/참조누락0/루트자산0. 공개 release·bundle SHA와 공개 in-app browser 문항/설정 버전을 확인했다.
- NOT DONE: 직접입력·단계별 힌트·인출강도, 전체 backfill/retry/coverage denominator, 실제 Safari/Chrome/Samsung Internet 실기기 확인은 미완료다.
- NEXT: `wrap up`처럼 여러 sense가 가능한 다음 숙어는 먼저 `일을 마무리하다`/`몸을 따뜻하게 감싸다`/`물건을 싸다`의 경계를 독립 사전으로 분리한 뒤, 한 sense만 source→예문→정의/문맥 문제→UI vertical slice로 닫는다. 근거가 부족하면 production으로 승격하지 않는다.

## 직전 batch — `abide by` 한 sense·두 정본행 VERIFIED / 2.9 공개 확인

- 기존 `idiom-corrections`의 Collins·Cambridge 독립 대조와 기존 구성 해설을 재사용했다. `JBKROW000004`와 `JBKROW002049`를 `규칙·결정·약속을 따르고 지킴` 한 production sense로 묶었고, `can't abide`의 `견디지 못하다` sense는 섞지 않았다.
- 자체 concise/full 정의·예문·정의/문맥 prompt를 추가했다. near synonym은 `comply with`, `adhere to`, 오답은 `agree with`(의견 일치), `put up with`(참다), `appeal against`(이의 제기)로 역할을 분리했다. 한국어는 정답 전 단서로 노출하지 않는다.
- VERIFIED: active-recall 9sense/10행/정의10/concise10/예문10/sense-safe 관계10/영영문제 가능10/failure0. targeted20테스트, 전체 TypeScript·data/sense 감사·22파일171테스트 통과(인증1skip), diff 공백 검사. Production2.9 build audit HTML22/학습JSON8/참조누락0/루트자산0. 공개 release·bundle SHA와 공개 in-app browser 문항/설정 버전을 확인했다.
- NOT DONE: 직접입력·단계별 힌트·인출강도, 전체 backfill/retry/coverage denominator, 실제 Safari/Chrome/Samsung Internet 실기기 확인은 미완료다.
- NEXT: 기존 독립 검수 근거·명확한 sense 경계·겹치지 않는 오답3개가 있는 숙어 하나를 골라 같은 source→예문→정의/문맥 문제→UI vertical slice로 닫는다. 근거가 부족하면 production으로 승격하지 않는다.

## 직전 batch — `work out` 네 sense 분리 VERIFIED / 2.8 공개 확인

- 기존 검수 자산의 Oxford·Collins 독립 대조를 재사용했다. 정본 `work out` 4행을 `문제 해결`, `수치 계산`, `상황이 만족스럽게 풀림`, `운동`의 네 production sense로 분리했으며 사전 원문은 복제하지 않았다.
- 각 sense에 자체 concise/full 정의·예문·정의/문맥 prompt·서로 겹치지 않는 오답3개를 연결했다. solve/calculate/succeed/exercise를 한 문제의 동의어로 섞지 않고 문장 구조·목적어·주어에 따라 고정했다. 한국어는 정답 전 단서로 노출하지 않는다.
- 구성 해설 15번째 항목으로 `work`와 부사적 소사 `out`을 연결했다. 답·결과가 드러나는 이미지는 현대 의미 이해용이며, out 하나가 모든 sense를 만든다는 역사적 어원/일반 공식으로 주장하지 않는다.
- VERIFIED: active-recall 8sense/8행/정의8/예문8/sense-safe 관계8/영영문제 가능8/failure0. targeted18테스트, 전체 TypeScript·data/sense 감사·22파일169테스트 통과(인증1skip), diff 공백 검사. Production2.8 build audit HTML22/학습JSON8/참조누락0/루트자산0. 공개 in-app browser에서 계산 sense의 영영 정의→`work out` 단일정답 문항과 한국어 비노출, 설정 버전을 확인했다.
- NOT DONE: 직접입력·단계별 힌트·인출강도, 전체 backfill/retry/coverage denominator, 실제 Safari/Chrome/Samsung Internet 실기기 확인은 미완료다.
- NEXT였던 숙어 후보 선별은 위 `abide by` batch로 닫았다.

## 직전 batch — `take for granted` 두 sense 분리 VERIFIED / 2.7 공개 확인

- 기존 검수 자산의 Collins·Merriam-Webster 독립 대조를 재사용했다. 하나의 APPENDIX 행을 `확인 없이 사실로 전제`와 `익숙해서 가치를 간과`의 두 production sense로 분리했다.
- 각 sense에 자체 정의·예문·정의/문맥 prompt·오답3개를 연결하고, 구성 해설로 `take A`와 `for granted`의 현대 의미 고리를 설명했다. 사실 판단과 가치 판단은 같은 문제에 섞지 않았다.
- VERIFIED: 당시 active-recall4sense/4행, 전체22파일167테스트, Production2.7 build/Pages/in-app browser 확인. 전체 backfill/실기기 검증은 완료하지 않았다.

## 직전 batch — 숙어 active recall 두 번째 vertical slice VERIFIED / 2.6 공개 확인

- 기존 검수 자산 재사용: `put the cart before the horse`는 idiom-corrections와 expression-composition에 Oxford·Collins 독립 대조, 자체 정의·예문, 수레/말 결합 이미지가 이미 있었다. 새 사전 원문을 복제하지 않고 이 검수된 sense만 active-recall production에 연결했다.
- 적용: JBKROW022984 한 행에 `later step before the earlier dependent step` sense, concise 정의, 자체 예문, 정의/문맥 prompt를 추가했다. near paraphrase와 관련 표현은 exact synonym으로 승격하지 않았고, `jump the gun`은 너무 이른 행동, `get ahead of oneself`는 앞선 결과 가정이라는 차이를 오답 이유에 고정했다.
- 의미 경계: 핵심은 단순 성급함이나 기회 상실이 아니라 의존하는 두 단계의 선후 역전이다. `before`는 두 대상의 순서 비교이며 수레/말 이미지는 현대 의미 이해용이지 최초 역사 어원 주장으로 표시하지 않는다.
- VERIFIED: active-recall 감사 2sense/3행/정의3/concise3/예문3/sense-safe 관계3/영영문제 가능3, targeted 19테스트, 전체 TypeScript·data/sense 감사·22파일165테스트 통과(인증1skip), 변경 lint 오류0, diff 공백 검사. Production build audit HTML22/학습JSON8/참조누락0/루트자산0. 로컬 화면에서 정의·문맥 문제와 정답 후 분리된 EN/KR/Near/Related UI, 공개 in-app browser에서 영어 문맥 문제를 확인했다. 전체 38,163행 보강 완료가 아니다.
- NOT DONE: 직접입력·힌트단계·인출강도, 전체 backfill/retry/coverage denominator는 미완료다. 실제 Safari/Chrome/Samsung Internet 실기기 확인도 하지 않았다.
- NEXT: `take for granted`처럼 sense가 둘인 숙어는 의미를 분리하고 독립 사전 대조한 다음에만 다음 production slice로 추가한다.

## 직전 batch — 영어 능동 인출 첫 production sense VERIFIED / 2.5 공개 확인

- P0 원인: 영영 정의/예문/관계가 UI에서 비어 보인 주원인은 표시 컴포넌트가 아니라 실제 production 학습 데이터가 139sense/218행에만 있고 `jury foreman` 두 원본행에는 연결이 없었던 것이다. legacy 표제어 동의어 배열은 11,277행에 있지만 sense 검증 자료가 아니므로 영영 정답 근거로 승격하지 않았다.
- 적용: `jury-foreman:leader-of-jury` 한 sense를 JBKROW019189/JBKROW023301에 연결했다. Oxford·Collins에서 의미를 독립 대조하고 원문을 복제하지 않은 자체 정의/간결 정의/예문, variant `jury foreperson`, near/related 관계와 정의·문맥 prompt를 저장했다. 일반 foreman의 supervisor/overseer는 exact synonym으로 넣지 않았다.
- 출제/UI: 검수된 두 행에서 기존 동의어 진입이 영영 정의 또는 문맥 → target word 4지선다로 우선 전환된다. 정답 전에는 표제어·한국어를 숨기고, 정답 뒤에는 단어 / EN / KR / Exact·Near·Variant·Related chip / 접힌 예문·전체 정의로 분리한다. 일반 문제와 오답 복습이 같은 sense/채점/중단복원 계약을 사용한다.
- VERIFIED: 전체 verify의 data/sense/active-recall 감사·TypeScript·22파일163테스트 통과(인증1skip), 변경 lint 오류0(기존 `lib/vocab.ts` Array<T> 경고3), diff 공백 검사, Production 2.5 build audit HTML22/학습JSON8/참조누락0/루트자산0. 로컬 in-app browser에서 `jury foreman` 문맥 문제 → 정답 → EN/KR/관계 분리 → 새로고침 후 같은 답/문항 복원을 확인했고, 공개 in-app browser에서 정의 문제를 확인했다. 이는 실제 iPhone/Galaxy Tab/Safari/Chrome 실기기 검증이 아니다.
- COVERAGE: 전체38,163행 중 production active-recall 1sense/2행, 영영 정의2행, concise2행, 예문2행, sense-safe synonym/variant2행, phrase3,731행 중2행. 실패 상태0은 등록된 1sense 내부 결과이며 미등록38,161행이 보강됐다는 뜻이 아니다.
- NOT DONE: 직접입력형, 단계별 Hint 1~4, 인출강도 저장, 전체 DB backfill/retry queue, 전체 sense 분리·definition/synonym/example coverage는 미완료다. 이번 결과는 좁은 첫 vertical slice이며 전체 요구 완료가 아니다.
- NEXT/P0: phrase 우선으로 `in lieu of` 같은 다음 항목 하나를 source→sense→예문→정의/문맥 문제→UI까지 같은 방식으로 닫는다. 대량 자동 보강 전에 미등록 항목까지 포함하는 failure queue와 coverage denominator를 별도 설계한다.

## 현재 batch — capricious sense 문항 VERIFIED / 2.4 공개 확인

- P0 원인/근거: capricious→mercurial의 승인 범위를 표제어 전체가 아니라 `기분에 따른 예측 불가한 태도 변화` 1sense/4원본행으로 제한했다. Oxford/Merriam-Webster의 capricious/mercurial 본문과 Merriam-Webster irritable/indecisive, Oxford calculating 본문을 대조했다. 사전 정의·예문 원문은 앱에 복제하지 않고 자체 한국어 풀이와 문맥을 작성했다.
- production 문항 `capricious.unpredictable-mood.v1`: 협상 조건이 그대로인데 사절이 동의→거부→동의로 단호하게 뒤집는 문맥. 정답 mercurial, 오답 irritable/indecisive/calculating은 짜증·결정 주저·의도적 계산과 구별한다. 형용사4개, quality B다. B는 편집 등급이며 독립 인간 검수나 학습 효과 증명이 아니다.
- 적용행 JBKROW000003/002257/026187/030584만 연결. 활달함/수은/수성 및 다른 capricious concept4행은 제외했다. 전체 production coverage는4표현/6sense/6문항/16행이며 전 어휘 완성률이 아니다.
- VERIFIED 회귀: 4행×3모드×12회 선지 섞기, 정답1개, 선지 역순, main/review/resume 동일 sense, 구 headword-level 세션 거절, 다른4행 미전파, flashcard/직접입력 보존. 기존 fixture가 새 sense 경계와 충돌한 두 테스트를 다른 legacy 행 기준으로 바로잡았다.
- VERIFIED: `pnpm verify` 전체 TypeScript/data·sense 감사/160통과·인증1skip, 변경 TS lint 오류·경고0(기존 module-format 경고 별도), diff 공백 검사, Production build audit HTML22/학습JSON8/누락참조0/루트자산0.
- VERIFIED 배포: main88c1562, Pages3f9cd38, Actions35623473165 success. 공개 release.json/번들 SHA/4개 route/8개 학습JSON을 로컬 산출물과 대조해2.4 일치를 확인했다.
- NOT VERIFIED: 실제 2.4 Chrome/Safari/Samsung Internet 화면·터치, 사용자 학습효과, 사람이 읽는 최종 편집 품질. 공개 저장기록을 오염시키지 않기 위해 공개 문항 답변은 만들지 않았다.
- 2027 편입 DB 규칙을 `docs/MASTER_DB_SYNC_RULES.md`와 운영 규칙에 추가했다. 이 저장소에서는 중앙 DB의 실제 위치·마지막 동기화 시점을 확인하지 못했으므로 이번 검수값의 중앙 DB 반영은 `sync_required`다. 앱 export/2.4 공개 동기화는 완료했다.
- NEXT/P0: 중앙 `2027 편입 마스터 DB` 연결 위치/형식을 실제 확인한 뒤 capricious 검수값을 중복·충돌 검사해 동기화한다. 연결이 없으면 다음 회차에 다른4행 또는 다음 숙어/표현 중 재현 가능한 sense 혼입을 하나 선택해 동일한 좁은 batch로 닫는다.

## 직전 batch — 첫 숙어 관계 연결 VERIFIED / 2.3 공개 확인

- 편입 실전 출제 스킬의 의미→문맥→경쟁 답 반례 검수를 적용. blind alley→cul-de-sac의 비유적 명사1sense/1문항/2원본행만 연결했다. 전체 생산 문항은3표현/5sense/5문항/12행, 전 어휘 개선 완료가 아니다.
- 명시 source 행/뜻/concept→targetSense/excludedSense 계약을 본·오답 엔진과 단어장 펼치기에 사용. 생성/출력은 같은 production 문항을 공유하며 교차검수 JSON 자체를 승인 정답 목록으로 import하지 않는다. 건물 도로/해부학 sense나 다른 미검수 동의어를 섞지 않는다.
- 사전 본문 대조에서 bottleneck에는 impasse 뜻도 있어 오답 후보에서 제외. temporary setback/detour/turning point를 문맥 제한과 함께 편집. B등급은 내부 판단이며 독립 인간 검수/학습 효과 미검증.
- 저장 sense의 자체 production/정답 flag를 믿지 않고 현행 승인 문항과 대조한다. 이전 headword 문항·변조된 sense·철회된 문항은 원본을 보존하며 복원을 거절, 자동 재채점하지 않는다. 보조 flashcard/직접입력 및 기존 점수/번호는 보존.
- VERIFIED: 전체 verify156통과/인증1skip/전체tsc/data·sense audit(09.15 12:04), 변경8파일 lint 오류/경고0(기존 도구 module-format 경고 별도), Production 빌드 및 Pages 복사본 audit HTML22/학습JSON8/참조누락0/루트자산0. basepath experimental/Browserslist/NO_COLOR 경고는 기존과 같음.
- 신규5회귀: 두행×3모드×12반복72조합·다른2행에 전파하지 않음·원본 불변·선지 역순·본/오답/복원 공유·정답/관계/flag를 함께 위조한 snapshot 거절·철회/원본변경/옛 legacy snapshot 거절·보조모드 유지.
- Windows Chrome 로컬: 검색4행→첫행 관계 펼치기→뜻 숨길 때 상세 DOM 제거→영영 문맥 문제 temporary setback 오답→일반 새로고침→같은 문맥/선지/오답1 복원→결과0/1→오답 복습 cul-de-sac 더블클릭→결과1/1, console error0.
- Chrome viewport390×844에서 해설/마지막 출처 버튼 접근과 1280×800에서 본문 폭/해설 줄바꿈 확인, 이후 override 해제. 실제 터치/Safari/Samsung Internet을 대신한 검증이 아니다.
- NOT DONE: 다른 blind alley 2행/다른 동의어와 나머지 어휘의 sense 경계, 일반 distractor/POS quality gate, 오답의 특정 sense 보존, 자동 오늘학습. 현재 하나의 연결 batch만 닫았다.
- 후속: capricious 검수 경계와 관계 근거는 위 현재 batch에서 처리. 실제 선지 연결은 아직 미완료이며2.3 배포 자체를 반복하지 않는다.

## 이전 batch — 숙어 관계 교차검수와 검수 상태 보호 / 앱 2.2 유지

- 04:08 신호 처리 중 잠금 도구 응답이 약27,296초 지연됨. 11:44 LOCK_ACQUIRED 확인 후에만 실제 수정했고 11:50까지 작업했다. 공백 원인은 미확인, 공백을 개발시간으로 합산하거나 무인 정상 실행으로 보고하지 않음.
- data/synonym-reviews.json: blind alley→cul-de-sac의 '성과 없는 진행 방향' 1sense/2원본행(JBKROW009289, JBKROW011482)을 cross-checked로 저장. 의미핵·쉬운 풀이·의미 제한·자체 작성 새 문맥2개·증거 구절 포함. 어원 주장을 하지 않으며 도로/해부학 뜻을 비유적 답에 합치지 않는다.
- 근거 본문: [Oxford blind alley](https://www.oxfordlearnersdictionaries.com/definition/english/blind-alley), [Merriam-Webster blind alley](https://www.merriam-webster.com/dictionary/blind%20alley), [Merriam-Webster cul-de-sac](https://www.merriam-webster.com/dictionary/cul-de-sac), [Collins cul-de-sac](https://www.collinsdictionary.com/dictionary/english/cul-de-sac). 무료 열람 자료의 정의/예문 원문을 복제하지 않음. AHD도 읽었지만 HarperCollins와 중복 출판사이므로 별도 독립 출판사로 세지 않음.
- scripts/lib/synonym-reviews.ts가 출처/문맥 근거/중복 관계/포함·제외 sense 충돌을 검사. 조회 시 원본 뜻·concept·대상 행ID·합쳐진 뜻이 달라지면 검수 표시를 candidate(stale)로 되돌려 재검수하도록 함. 생산 승격은 허용하지 않음.
- 감사 CLI 실제 결과: crossCheckedRelations2 / stale0 / production0. 이는 원본행 관계 건수이고 고유 검수sense는1이다. 나머지 두 blind alley 행은 도로 뜻만 있어 비유적 검수를 자동 전파하지 않음.
- VERIFIED: 신규2테스트(근거 계약·실데이터2행 연결·뜻/개념 변경 시 stale·production 거절), 전체 verify151통과/인증1skip/tsc/data audit, 변경3파일 lint 오류/경고0(기존 도구 module-format 경고 별도).
- NOT DONE: 앱 생성/채점/단어장/복원에 이 관계를 아직 연결하지 않음. source/data 검수 단계 완료이지 사용자 선지 수정 완료가 아님. app/lib 런타임 및 release.config 불변이므로 새 build/Pages 배포를 반복하지 않았고 공개2.2 유지.
- NEXT: 이 검수 자료의 sourceSense/targetSense를 공통 동의어 조회/정답 계약에 연결하는 최소 경계를 구현한다. contextual 문항과 단어장 표시, stale 저장세션 처리까지 테스트한 뒤에만 배포. 나머지 미검수 동의어를 같은 concept이라는 이유로 자동 승인하지 않는다.

## 이전 batch — legacy 의미 경계 검수 후보 추출, VERIFIED 도구

- 09.15 01:52~01:58: scripts/audit-legacy-synonyms.ts + scripts/lib/legacy-synonym-audit.ts 구현. 숙어/표현 우선, 안정적 행ID·연결 대상·결합 표시 뜻을 가진 candidate만 추출한다. 표제어 인자/--all 사용법은 DEVELOPMENT.md. 후보를 정답이나 오류로 자동 확정하지 않으며 원본/런타임/학습 기록은 수정하지 않음.
- 실제 38,163행: legacy 관계65,171, 별도 contextual 관계48. 여러 뜻 문구 결합 후보23,564관계 / 8,616행 / 1,660표현, 이 중 숙어/표현15행. 이는 오답 수 또는 검수 완료율이 아니다. 같은 뜻의 번역 차이도 포함하고, 한 문자열 안의 다의어는 놓칠 수 있음.
- 진단 정정: 이번 전체 현행 데이터에서 headword fallback0, 연결누락0. 실제 후보는 모두 concept 내부에서 여러 한국어 뜻이 결합된 경로다. 따라서 fallback 제거만으로 해결된다고 판단하지 않는다. concept=단일sense라는 가정부터 바로잡아야 함.
- VERIFIED: 신규3테스트(전체 후보의 getSynonymDetails 출력 일치·데이터 불변·누락/다중의미/개념우선 fixture), 전체 verify149통과/인증1skip/tsc/data audit, 변경3파일 lint 오류/경고0(기존 도구 module-format 경고 별도).
- 앱 소스/학습 데이터/버전은 변경하지 않아 2.2 빌드·Pages 배포를 불필요하게 반복하지 않았다. 이번은 개발용 검수 도구 완료이며, 사용자 화면의 선지가 개선됐다고 보고하지 않는다.
- 당시 후보: blind alley8972 → cul-de-sac의 '막다른 골목/궁지/맹장' 혼합. Cambridge 직접 페이지403으로 멈췄던 독립 사전 대조는 이번에 Oxford/Merriam-Webster 본문으로 보완(위 batch). runtime 적용은 여전히 미완료.
- capricious의 기존 재현도 유지. 후보에는 fickle의 유사한 한국어 풀이 차이처럼 오류가 아닐 수 있는 사례가 있어 문자열 차이만으로 대량 차단하지 않는다. 독립 사전 대조→명시 sense-target 연결→공통 엔진/단어장/복원 회귀가 다음 기능 batch다.

## 이전 batch — 채점/복원 계약 P0, VERIFIED / 2.2 배포

- VERIFIED 재현: 기존 한글/동의어 문항 모두 다른 문항의 선택지 ID도 정답으로 인정. 정답 flag와 표시 답을 오답으로 옮겨도 validateQuestion이 통과함. 새 회귀6개 중4개가 수정 전 실패, 정상 JSON/역순 복원2개 통과.
- 원인: 한글 채점은 인자로 받은 isCorrect를 신뢰, 동의어 채점은 현재 선택지 소속 없이 표제어 배열만 확인. 세션은 legacy에 공통 validateQuestion을 적용하지 않음.
- 수정: 현재 문항 ID/value 소속 확인 → 저장된 정답 근거와 flag 독립 대조 → 세션 복원에도 동일 계약 적용. 단어/뜻/동의어 원본과 학습 기록은 변경하지 않음. 손상 정답 키는 원본을 보존하고 복원을 거절하며 자동 초기화하지 않음.
- 전체 verify09.14 23:54: 데이터/sense audit, 전체tsc,146테스트 통과(인증1조건부skip). 신규8회귀 포함; 저장·재접속5모드/기존 sense216조합/채점/큐 회귀 유지. 변경4파일 lint 오류/경고0(도구 module-format 경고 별도).
- Production build 및 Pages 복사본 audit: HTML22, 학습JSON8, 참조누락0, 잘못된루트자산0, manifest 일치. 기존 experimental basepath/Browserslist/NO_COLOR 경고는 남음.
- 내장 브라우저 로컬: abide by 정답→일반 새로고침→동일 선택지/1정답 복원→capricious 오답→결과1/2→오답 복습 mercurial 빠른 더블클릭→결과1/1, console error0. 테스트용 별도 localhost:4132 저장소만 사용. 폰 크기390×844 override 요청으로 시작했으며 실기기 터치는 미검증.
- NOT DONE: 잘못된 정답 키를 주입하는 UI 실험은 하지 않았고, 이 경로는 실제 저장 모듈+모의 디스크 회귀로 검증. 사전 의미의 사실성이나 전체 sense/POS 경계를 이번 패치로 검증한 것은 아님.
- NEXT: capricious 한글 보기에서 'A해 버리다/변덕스러운/강인한/도주'가 실제 생성된 사례 확보. 동의어 보기 mercurial/filthy/untoward/mucky도 관찰. 품사·문맥/의미범위 적합성 및 오답 상호 겹침을 다음 source/sense batch에서 검수; 현재 generation 전체를 고품질로 표시하지 않음.

## 이전 batch — VERIFIED

- 재현: sanction496의 승인/제재가 한 뜻에 섞이고 동사 문항에 erratic/faddish/fickle(형용사)이 생성됨. getSynonymDetails의 뜻 결합과 배열 기반 채점이 원인 경로다. headword fallback도 코드에는 존재하지만 현행 전수 감사에서는 실행된 관계0으로 확인했다.
- data/sense-questions.json: sanction/all but 2표현·4sense·4문항·기존10행. 각 문맥에 정답/3오답/이유/2사전 근거를 분리했다. Cambridge 검색 색인과 Collins 본문 대조; Cambridge 직접 페이지 접근 실패를 출처 메모에 명시했다.
- 새 production 상태는 출제 적격 데이터 상태이며 전체 품질 인증이 아니다. 내부 A등급은 AI 편집 검수 판단, 학습 효과의 증명이 아니다. 전체 기존 어휘를 A로 인증하지 않는다.
- 새 경로: 본·오답 공통 문맥/해설, 정답 ID 판정, 실제 sense/선택지 snapshot 복원. 후보/보류/C가 legacy fallback으로 우회하지 않게 검사한다.
- 결과 화면에서 sanction의 혼합 뜻/동의어를 다시 보여주던 경로도 두 문맥별 설명으로 수정. 응답 후 문맥이 아래로 이동하던 화면 흔들림 제거.
- 기본 화면 플래시카드/직접입력은 보조 학습 펼치기로 이동, 기능/라우트/옛 세션 호환 보존. 새 네 가지 기본 유형 전체나 자동 오늘학습을 구현한 것은 아니다.
- Light/Paper/Dark 전체 토큰·설정·DOM·CSS·초기 HTML 연결. v2 light→v3 paper, dark 유지, 신규light. 옛 설정 삭제 없이 공통 저장 큐 사용. 손상 테마는 자동 덮기 대신 안내하며 채점 저장을 막지 않는다.
- 웹 탭52px/아이콘21/라벨10, 끝padding48, 공통 본문max-width880. native inset 계산 보존.
- release manifest sourceCommit/sourceDirty/dataVersion/learningDataVersion/builtAt와 KST 동일 기준 시각, metadata/basepath audit 추가.

## 이전 2.1 검증 근거와 범위 (현재 2.2 검사와 구분)

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

1. NEXT / P0: 나머지 어휘의 headword/sense/POS/source 경계. 첫 숙어 비유적 관계2행 연결은2.3으로 닫았다. 다음은 기존 재현 capricious 선지의 품사/의미 중복을 근거 기반으로 검수한다. .p는 POS가 아니라 IPA임에 주의. 충분한 정답 근거/서로 겹치지 않는3오답/그럴듯한2오답이 없으면 안전한 비출제를 지원해야 한다.
2. P0/P2: 본/오답 기록은 여전히 headword번호 중심. 실패한 특정 sense를 다음 오답 문제로 유지하는 것은 NOT DONE. 기존 오답 번호/성적을 임의 변환하지 말고 additive 저장/복원 계약과 회귀 테스트부터 설계한다. 옛 중단 세션은 보존하며 자동 재채점하지 않는다.
3. P1: 자동 오늘학습 queue, 네 기본 유형(영한sense/영영관계/문맥/contrast) 전체 연결 미완료. 기존 세부 모드 보존. 모바일 실기기 검증과 랜덤 순서 안정성도 남음.
4. P1/P2: 단어장 검색 실측38163행/8검색×10 median14.97ms,p95 70.21ms. 북마크 state 변경 시 filteredVocab의 shuffle 재실행 코드 확인, 수정 보류. 새 검색엔진 도입 없이 순서 생명주기 분리부터 검증한다.
5. 콘텐츠: 반복 가능한 후보 생성→검수→생산 파이프라인 전체는 NOT DONE. 현재 production active-recall은 `jury foreman`, `put the cart before the horse`, `take for granted`2sense, `work out`4sense, `abide by`, `teem with`, `wrap up`의 좁은 11sense/14행뿐이다. 다음 숙어도 기존 독립 검수 근거와 sense 경계부터 확인한다. 의미핵 전수 완료로 보고하지 않는다.
6. 오답 전용 중단 복원, 여러 탭 동시 기록 보호, 깨진 기록 사용자 백업/복구, 오답 원인 추론/sense mastery/학교별 기출 환류 미완료. 학습 큐를 우회한 AsyncStorage 쓰기 금지.
7. 플래시카드 숨긴 뜻이 DOM 접근성 트리에 남는 후보 관찰, 실제 마운트/aria 확인 필요. 시각적으로 답이 보인다고 단정하지 않는다.
8. P3: CI 자동 verify/build, 공통 swipe의 실익 있는 최소 추출, 오래된 PR1/2/3·claude/*의 main 미반영 가치 비교. 삭제/branch protection 변경 금지.

## 데이터 및 이전 안정 기능 보존

- 정본38163행. 숙어·표현3731행/소문자 표제어1877개(연어·고유명사 포함).
- 깊이 학습139sense/218행, 문맥 연습6표현/13문항/17행, 구성요소 해설15표현, 새 본문풀6문항/16행, active-recall11sense/14행은 서로 다른 지표다.
- 기존 all but 의미핵1표현/2행과 문맥연습3문항 유지. 미국식 허가 녹음17개, 나머지en-US합성음.
- 1.9 본 문풀 마지막 세션 문제/보기/응답/이전위치/입력초안/힌트/플래시 상태 복원 유지. 완료/다른 요청/정본 변경 때 재사용하지 않음.
- 1.8의 공통 learningStorageQueue/persistLearningEntries와 실패 재시도/깨진 원본 보존 유지. 병렬 북마크 유실·오답 부활·오래된 값 덮기를 회귀 검사했다. 여러 탭 원자성까지 보장하지 않는다.
- 별도 server/auth.ts/서버 동기화 배포와 GitHub Pages를 혼동하지 않는다.

## 재개와 사용자 작업 보호

- 같은 main/같은 대화/heartbeat voca-nexus 매시간. 기존 예약을 매회 새로 만들지 않는다.09.15 00:50 KST 실제 신호 수신 후 진행 중 2.2 공개 확인을 이어서 마감. 신호 수신≠지속 코딩. 절전/앱 종료/크레딧 소진 뒤 무인 복구는 미검증. 새 비용/API 전환 금지.
- 재개: Git/status→이 상태→최근 diff→NEXT P0→관련 검사.2.3 재빌드/재배포나 옛1.8 작업 반복 불필요.
- 이번 잠금 세션35841/PID30820에서 `LOCK_ACQUIRED` 후 수정했고, 문서 커밋 뒤 Enter로 해제할 예정이다. 다음 회차는 새로 잠금 획득한다.
- 사용자 보존: server/auth.ts, analysis/, build/, output/, pnpm-workspace.yaml, qa_claude/, scripts/analyze_exam_corpus.py, scripts/build_exam_analysis_queue.py, scripts/incremental_exam_corpus_update.mjs, scripts/incremental_exam_corpus_update.py, tmp/, vocab_project/를 수정·커밋·삭제하지 않았다. scripts/__pycache__도 커밋하지 않음.
- 다음 실기기 확인 필요 외에 현재 사용자 인증/설정 행동은 요구하지 않는다.
