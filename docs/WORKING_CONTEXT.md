# FINETUNE 현행 스냅샷

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
