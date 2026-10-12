# 개발 메모리 진단·실행 계약

적용 작업실: 기존 `finetune-audit-trial` 통합 source branch. 원본 OneDrive main·사용자 프로그램·페이지파일·학습 기록은 변경하지 않는다. 현재 상태는 WORKING_CONTEXT를 따른다.

## 구분

- 물리 available RAM: Windows PerfOS AvailableBytes. 프로세스 working set은 공유 페이지를 포함하므로 단순 합산을 실제 사용 RAM으로 부르지 않는다.
- 커밋: CommitLimit-CommittedBytes. 프로세스 private bytes는 RAM 상주량이 아니며 페이지파일로 뒷받침될 수 있다.
- V8 heap 한계: Node 자체 old-space/heap 오류. 커밋이 충분해도 낮은 heap 상한에서는 실패한다. 기존 전체 타입 실측1,386,835K와1GiB실패/2GiB통과는 전체 RAM 부족과 구분한다.
- Windows -1073740791은 native crash이며 근거 없이 OOM으로 바꾸지 않는다. 기록에 실패 단계·child PID·종료코드/signal·Node stderr의 PID후보·실측 peak/current 값을 남긴다.

## 기본 실행

```powershell
pnpm memory:diagnose
pnpm test
node scripts/run-tests.mjs tests/store-read-protection.test.ts
node scripts/verify-project.mjs
node scripts/build-production-web.mjs <새 빈 QA 폴더>
pnpm dev:metro
```

`VITEST_MAX_FORKS/MIN_FORKS/MAX_THREADS/MIN_THREADS`, `FINETUNE_BUILD_MAX_WORKERS`(구별칭 VOCANEXUS)와 CLI maxWorkers는 자원 계획의 상한으로 재사용한다. CPU수만큼 자동 생성하지 않는다. 각 단계 시작 시 물리/commit·기존heavy process를 다시 확인하여1~2workers로 제한하고 min은1로 맞춘다. 메모리 기준은보수적 예산이며 실제 peak 보증이 아니다. 실행 중 이미 시작한 pool을 무중단 축소하는 기능이라고 주장하지 않는다.

전체 type/regression/export는 physical/commit 각각3GiB 이상이어야 시작한다. 명시적 파일 영향 검사는1worker/768MiB여유, 작은 동일 자원정책 테스트는 저오버헤드Node경로(384MiB)로 실행할 수 있다. 다른Vitest/type/Metro가 있으면 겹쳐 시작하지 않는다. 미측정 Windows commit은 충분하다고 추정하지 않는다. 가용 상태가 부족하면 **exit75/BLOCKED_RESOURCE**, child PID없음, 성공으로 처리하지 않는다. 중단/실패 자동 무한재시도나 사용자 프로그램 종료는 하지 않는다.

기존 규칙의 OS개발잠금도 계속 필수다. `powershell.exe -File`의 실행정책 때문에 측정이 차단되는 환경에서는 저장소의 확인된 측정코드만 `-Command`로 읽기 전용 실행한다. 실행정책·권한을 바꾸지 않는다. 원본 commandLine·환경변수·토큰·서버 오류·학습 기록은 보고서에 넣지 않는다.

## 저메모리 검증 및 청크 처리

전체 type에 확인된 실측보다 낮은 heap을 강제로 지정한 경우 `BLOCKED_HEAP_BUDGET`/75로 따로 기록한다. heap을 자동 확대하지 않으며 이 사유를 물리RAM 부족으로 오인하지 않는다.

- `pnpm test:memory`: full Vitest에 연결된 **동일 assertion**을 node:test로 실행(새 테스트만, 기존 앱 회귀를 대신하지 않음). 256MiB old-space 상한은 가벼운 도구검증용이며 전체 Node heap을 계속 늘리는 정책이 아니다.
- `public-text-scan.mjs`:64KiB UTF8 청크,128char 겹침 및 유한상태로 긴토큰/헤더 처리. 경계검사/원래 보안 regex 결과를 유지한다. Production감사 JSON은 한 그룹씩 검사하고 현재 JS전체를 여러 번 보관하지 않는다.
- `writeJsonCheckpoint`: 내용이 같으면 bytes/mtime보존. 감사보고서 root generatedAtKst만 비교에서 제외할 수 있고 검수일·원문·ID·정답·provenance는 무시하지 않는다. 변경된 출력은 인접temporary→rename, 깨진 기존출력은 자동덮어쓰기하지 않는다. 입력검수나 의미검사를 생략하는 캐시가 아니다.

## 실측 보고서

`analysis/qa/memory-current.json`, `resource-runs/<run>.json`와 `<run>-processes/`에 저장한다. PID/thread별 Node OSmaxRSS, finalheap, 실제 heap한계와 주기적Windowsprivate/working-set표본을 구분한다. 서로 다른 시점의maxRSS를 더해 동시peak라고 부르지 않는다. fatalV8에서는 exit hook이 없을 수 있어 started-only와 stderr PID후보/Windows표본을 보존한다. 일부값미측정은0으로 포장하지 않는다.

같은 산출물 전후 비교:

```powershell
node scripts/benchmark-memory-audit.mjs analysis/qa/production-1.0-20261013-0148 aa094700
```

2026-10-13실측:감사OSpeak 약122MiB→약71MiB(약42%감소), 결과JSON완전동일. 반복실행시간은0.73~0.93s→0.75~0.77s 범위이므로 보편적속도향상을 주장하지 않는다. 생성기13파일 동일입력 재실행에서bytes/mtime13/13보존. 전체새빌드·전체회귀는RAM복구후별도 확인하며 구판489PASS를 새source성공으로 재사용하지 않는다.
