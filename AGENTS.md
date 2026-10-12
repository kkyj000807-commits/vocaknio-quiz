# FINETUNE 프로젝트 진입

## 판단 순서

1. 현재 사용자의 최신 명시 지시
2. `docs/WORKING_CONTEXT.md`의 확인된 현행 상태
3. `docs/AI_WORK_RULES.md`와 이번 작업에 해당하는 전문 스킬
4. `docs/history/`의 과거 기록은 추적 자료일 뿐 실행 규칙이 아니다.

데이터·안정 ID·학습 기록·정답 계약·저작권·사용자 변경 보호는 새 기능보다 우선한다. 실제로 읽지 못한 대화, 사이트, 기기 상태를 확인했다고 쓰지 않는다.

## 최소 진입 경로

- 항상 `docs/WORKING_CONTEXT.md`, `docs/AI_WORK_RULES.md`, `git status/diff`를 먼저 확인한다.
- 코드 위치와 검증 명령이 필요할 때만 `docs/DEVELOPMENT.md`의 관련 절을 읽는다.
- 자동 실행 또는 릴리스면 `docs/AUTOMATION_RUNBOOK.md`를 추가로 읽는다.
- 편입·기출·중앙 DB 동기화면 `docs/MASTER_DB_SYNC_RULES.md`를 추가로 읽는다.
- 모든 문서를 매번 처음부터 읽지 않는다. 현재 작업에 필요한 스킬과 참조만 연다.

## 전문 스킬 라우팅

- 뜻·숙어·초월번역·예문·문항의 의미 품질: `.agents/skills/transfer-english-reasoning/SKILL.md`
- 대량 콘텐츠 생성·정규화·검수·승격: `.agents/skills/finetune-content-pipeline/SKILL.md`
- 문제 엔진·적응형 출제·저장·복원·학습 이동 회귀: `.agents/skills/finetune-learning-engine/SKILL.md`
- 통합 회귀·Production 빌드·배포·공개 검증: `.agents/skills/finetune-release-qa/SKILL.md`

여러 스킬이 해당하면 콘텐츠 → 엔진 → 릴리스 순서로 필요한 것만 함께 적용한다.

## 잠금과 병렬 작업

- 수정 전 `docs/AUTOMATION_RUNBOOK.md`의 OS 잠금 절차를 따른다.
- 한 코디네이터가 잠금을 소유한 병렬 작업에서는 보조 에이전트가 잠금을 다시 잡지 않는다.
- 코디네이터가 파일 소유권을 명시하고, 한 파일에는 동시에 한 작성자만 둔다. 공유 검증·생성·빌드·배포는 코디네이터가 직렬 실행한다.
- 사용자가 승인한 내부 병렬 분석·구현은 가능하다. 새 사용자 대화, 예약, 외부 작업은 별도 요청 없이 만들지 않는다.
- 기존 미커밋 변경을 reset, 덮어쓰기, 광범위 stage하지 않는다.

## 제품 목표

최우선 목표는 편입영어 독해·논리에서 어휘와 숙어를 새 문맥에 적용해 점수를 얻는 것이다. 재현된 P0를 먼저 닫고, 전체 범위의 기본 coverage를 확보한 뒤 고위험 숙어·다의어·오답 밀집군을 집중 검수한다. 특정 숙어 하나의 완성이 나머지 기본 coverage를 막지 않는다. 공개 교습 원칙, 앱의 독자적 설계, 실제 검증 결과를 구분한다. 기본 검증 진입점은 `node scripts/verify-project.mjs`지만, 작은 변경마다 무조건 전수 실행하지 않고 영향 검사 → 통합 회귀 → 승인된 릴리스 게이트로 확장한다.
