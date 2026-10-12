---
name: finetune-release-qa
description: Validate and release an approved FINETUNE integration candidate through impact checks, integrated regression, fresh Production build, Pages deployment, and live browser evidence. Use for release readiness or deployment, not ordinary content authoring.
---

# FINETUNE 릴리스 QA

## 게이트 순서

1. 승인 범위, 파일 소유권, OS 잠금, Git 상태, 인증과 대상 원격을 확인한다.
2. 공유 생성기를 직렬 실행하고, 각 소유자가 전달한 영향 검사와 `node scripts/verify-project.mjs`를 코디네이터가 직렬 실행한다.
3. 파일 소유권 안의 승인 후보만 source 커밋하고 후보 SHA를 기록한다. 사용자 dirty 파일은 포함·정리·reset·stash하지 않는다.
4. 그 source SHA에서 새 빈 출력으로 `node scripts/build-production-web.mjs`를 실행하고, `node scripts/audit-production-output.mjs`와 release manifest에서 source commit/dirty, 표시 버전, 데이터 버전, KST 빌드 시각, base path와 참조 자산을 대조한다.
5. 이후 소스·데이터·생성기 입력이 바뀌면 앞선 검증과 후보 SHA를 무효화하고 2번부터 다시 검증·커밋·빌드·감사한다.
6. 승인된 후보만 source 원격과 Pages에 반영하고 Pages 상태·원격 SHA를 확인한다.
7. 실제 공개 URL에서 release 정보, 이번 변경, 캐시 갱신, 핵심 학습 흐름을 확인한다.

## 완료 경계

- 로컬 검사, 빌드, push, 배포 작업 성공은 각각 중간 상태다. 공개 URL에서 일치하는 산출물과 동작을 확인해야 Production 완료다.
- 실제 모바일 Safari·Chrome이 없으면 에뮬레이션으로 대체하지 않고 `NOT_VERIFIED`로 남긴다.
- 데이터·ID·기록·정답·권리 오류, sourceDirty 불일치, 자산 누락, 캐시된 이전 번들은 릴리스를 막는다.
- 표시 버전과 데이터 버전은 설정과 manifest에서 읽으며 스킬에 특정 숫자나 날짜를 고정하지 않는다.
- 같은 검사를 복제하지 않는다. 실패한 게이트의 원인을 고친 뒤 그 게이트부터 재실행하고, 상위 게이트는 영향이 있을 때 다시 실행한다.

별도 평가자가 현실적인 요청으로 forward-test할 때는 [인수 시나리오](references/acceptance-scenarios.md)를 읽는다.
