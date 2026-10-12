---
name: finetune-learning-engine
description: Change or review FINETUNE quiz generation, adaptive selection, answer contracts, local learning records, interrupted-session restoration, or learning navigation regressions such as mobile bottom routing. Use for engine, persistence, or learning-flow behavior, not content prose or deployment-only work.
---

# FINETUNE 학습 엔진

## 먼저 고정할 계약

- 입력·출력과 정답 단위를 실제 코드에서 추적한다. 중심 경로는 `lib/quiz-engine.ts`, `lib/sense-questions.ts`, `lib/adaptive-quiz.ts`, `lib/quiz-session.ts`, `lib/store.ts`, `lib/learning-write-journal.ts`다.
- 재현된 P0를 실패 테스트로 고정하고 가장 가까운 구현을 좁게 수정한다. 기존 helper와 공통 경로를 먼저 확장하고, 기존 경계로 표현할 수 없을 때만 테스트 가능한 최소 helper를 추가한다. 같은 목적의 helper나 평행 저장 경로를 만들지 않는다.
- word+해당 sense+concept의 정답 근거가 하나여야 한다. 다의어는 stable sense ID로 분리하고 문맥·품사에 맞지 않는 뜻을 정답이나 근접 오답으로 섞지 않는다.

## 저장과 복원

- 정답·오답·패스·헷갈린 선택·입력 초안·힌트·현재 위치를 현행 공통 큐와 journal을 통해 저장한다.
- 뒤로가기와 재개에서 같은 응답을 중복 채점하지 않는다. 완료 세션, 다른 요청 조건, 승인 데이터 변경 세션을 자동 재사용·재채점하지 않는다.
- 깨진 기존 값은 보존하고 사용자에게 복구 경계를 알린다. 오래된 값이 최신 변경을 덮지 않게 한다.
- 로컬 전용, 계정 동기화, 여러 탭 원자성의 실제 범위를 구분한다.

## 출제와 검증

- 범위 순환, 약점 복습 상한, 직전 문제·표제어·concept 중복 억제를 기존 계약대로 유지한다. 비율 변경은 별도 근거와 회귀가 필요하다.
- 그럴듯하지만 겹치지 않는 오답을 확보하지 못하면 비출제 또는 검증된 안전 모드로 전환한다.
- 관련 단위 테스트 → 저장/세션 통합 → 실제 `풀이·이전·다음·결과·오답·새로고침`과 학습 화면·모바일 하단 이동 순으로 검증한다. 릴리스 후보의 전체 검증은 `finetune-release-qa`에 넘긴다.
- 기존 테스트를 확장하고 같은 목적의 fixture, mock store, validator를 복제하지 않는다.

다의어 정답, 저장 복원, 모바일 하단·학습 이동의 독립 인수 검사가 필요하면 `../finetune-release-qa/references/acceptance-scenarios.md`의 해당 시나리오를 읽는다.
