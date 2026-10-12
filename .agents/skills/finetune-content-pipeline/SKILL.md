---
name: finetune-content-pipeline
description: Build, normalize, validate, and promote large FINETUNE vocabulary or idiom content batches while preserving stable IDs, provenance, rights, and reviewed sense boundaries. Use for bulk content work, not a one-off UI-only edit or deployment-only task.
---

# FINETUNE 대량 콘텐츠 파이프라인

목표는 생성량이 아니라 **추적 가능한 production sense와 새 문맥에서 쓸 수 있는 학습 콘텐츠**다. 실제 해설·문항의 의미 품질에는 `../transfer-english-reasoning/SKILL.md`도 적용한다.

## 절차

1. 정본 입력, 현재 schema, stable ID, 기존 review/production 항목과 중복을 확인한다. 재현된 P0를 먼저 닫고 전체 기본 coverage를 확보한 뒤 고위험 숙어·다의어·오답 가치가 높은 항목을 집중 batch로 묶는다.
2. batch manifest에 각 후보의 원본 ID, 표제어, 품사·구문, 목표 sense, provenance, 권리 상태와 최종 disposition을 남긴다.
3. 표제어 문자열이 아니라 sense 단위로 정규화한다. 반복 목록 행은 검수된 같은 sense에만 공유하고 다의어는 분리한다.
4. 재배포 가능한 정본과 기존 근거를 batch로 검사한다. 충돌·부분 동의·강도·격식·polarity·고위험 문항만 추가 독립 대조한다.
5. `candidate → cross-checked → reviewed → production`을 명시적으로 승격한다. 근거·권리·정답 계약이 부족한 항목은 이유와 함께 보류한다.
6. 변경한 데이터에 가장 가까운 builder/audit/test를 실행한다. 공유 index·public 산출물은 한 번 생성하고 코디네이터의 통합 회귀로 넘긴다.

## 불변 조건

- `assets/vocab-v1.4.json` 같은 정본과 기존 ID·저장키를 덮어쓰지 않는다. 중앙 DB 소비 경계는 `docs/MASTER_DB_SYNC_RULES.md`를 따른다.
- 수록 행, 고유 표현, 검수 sense, production 문항을 따로 센다. 일부 coverage를 전수 완료로 보고하지 않는다.
- 같은 원전을 복수 출처로 세지 않고, 접근하지 못한 페이지를 확인했다고 쓰지 않는다. 무료 열람과 재배포 권리는 별도다.
- 생성기·감사·테스트 helper를 복제하지 않는다. `docs/DEVELOPMENT.md`에서 현행 경로를 찾아 기존 파일을 확장한다.
- batch 크기는 고정 수나 시간보다 위험도와 검증 가능성으로 정한다. 오류가 한 항목에 국한되지 않으면 batch 전체 승격을 멈춘다.

## 게이트

- 콘텐츠 계약: stable item/sense 연결, 필수 해설·예문·출처·권리, 중복/누락, 보류 사유
- 영향 검사: 관련 build/audit와 가장 가까운 테스트
- 통합 후보: wordbook/문풀 loader와 index가 같은 production 수를 보고하고, 미검수 항목은 정답 근거나 production 승격 대상으로 노출하지 않음. 재배포 권리가 있고 상태·출처가 명확한 기본 사전 참고는 별도 참고층에서 표시할 수 있음

대량 보강의 독립 인수 검사가 필요하면 `../finetune-release-qa/references/acceptance-scenarios.md`의 콘텐츠 시나리오를 읽는다.
