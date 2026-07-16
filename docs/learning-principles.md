# 편입 영어 학습 자료 제작 지침 — Paul Nation식 어휘 학습 원칙

> 이 문서는 프로젝트의 학습 설계 기준이다. 데이터 제작·기능 개발 시 이 원칙을 따른다.

## 1. 핵심 방향

단어를 많이 나열하는 것이 아니라 **회상 테스트 → 간격 반복 → 기출 문맥 확인 → 동의어/반의어/패러프레이즈 연결**이 가능한 학습 시스템을 만든다.

1. **의도적 암기**: 영어 단어를 보고 한국어 핵심 뜻을 직접 떠올리는 구조. 단순 읽기 금지, recall 중심.
2. **간격 반복**: 당일 / 다음 날 / 3일 뒤 / 1주 뒤 / 2주 뒤 / 1달 뒤 복습.
3. **문맥 속 재확인**: 기출 문장·예문·콜로케이션으로 의미 고정.
4. **시험식 연결**: 동의어·반의어·논리축·패러프레이즈를 선지 판단에 바로 쓰이게 정리.

## 2. 단어 데이터 목표 구조

```json
{
  "word": "mitigate",
  "part_of_speech": "verb",
  "core_definition_en": "to make something less severe, harmful, or painful",
  "core_meaning_ko": "완화하다, 누그러뜨리다",
  "synonym_clusters": { "약화/감소": ["alleviate", "ease", "lessen"], "피해 완화": ["relieve", "soften"] },
  "antonyms": ["aggravate", "exacerbate", "worsen"],
  "collocations": ["mitigate the damage", "mitigate the risk"],
  "paraphrase_patterns": [{ "source": "mitigate the damage", "paraphrase": "reduce the harmful effects" }],
  "confusing_words": [{ "word": "alleviate", "difference": "고통·문제를 덜어주는 뉘앙스" }],
  "exam_point": "피해·위험·고통·영향을 '줄이다/완화하다' 문맥에서 출제"
}
```

현행 vocab.json 필드 대응: `w`(word), `k/k_short`(core_meaning_ko), `def`(core_definition_en), `s[]`(synonyms), `antonym[]`, `etym`(exam_point+첨언). **미구현**: synonym_clusters(의미권 분류), collocations, paraphrase_patterns, confusing_words, part_of_speech.

## 3. 단어 정리 출력 순서

영영 핵심 정의 → 한국어 핵심 뜻 → 동의어 클러스터(의미권별, 완전동의어/문맥유사어 구분) → 반의어 → 편입식 패러프레이징(본문→선지) → 빈출 콜로케이션 → 헷갈리는 유사어 → 시험장 판단 포인트.

## 4. 동의어 클러스터 기준 (의미권 예시)

- 약화/감소: reduce, lessen, diminish, abate, mitigate, undermine
- 강화/증가: intensify, reinforce, amplify, augment, enhance
- 거부/반대: reject, refuse, oppose, resist, object to
- 승인/수용: accept, approve, endorse, acknowledge
- 왜곡/조작: distort, manipulate, misrepresent, falsify
- 명확/불명확: clear, explicit, obvious ↔ vague, obscure, ambiguous
- 풍부/부족: abundant, ample, plentiful ↔ scarce, deficient, insufficient
- 지속/중단: persist, endure, continue ↔ cease, halt, suspend
- 원인/결과: cause, lead to, bring about ↔ result from, stem from
- 주장/반박: assert, claim, contend ↔ refute, rebut, challenge

## 5. 앱 필수 기능 (회상 테스트 장치)

1. 영→한 회상 테스트 (뜻 가리고 떠올리기) — ✅ 플래시카드/4택
2. 한→영 역방향 테스트 — ❌ 미구현
3. 동의어 클러스터 테스트 — ❌ 미구현 (동의어 4택은 있음)
4. 반의어 테스트 — △ 오답 선지로만 사용 중
5. 패러프레이즈 테스트 (본문↔선지) — ❌ 미구현
6. 오답 단어 자동 재출제 — ✅ 오답노트/오답 문제풀이/맞춤 출제
7. 느리게 맞힌 단어 표시 (slow 분류) — ❌ 미구현 (응답시간 미기록)
8. 기출 출처 태그 (학교·연도·유형·위치) — ✅ etym 기출 노트 + 각주

## 6. 복습 알고리즘 기준

상태: `new → learning → weak(자주 틀림) / slow(맞히지만 느림) → known → mastered`

간격: 처음 틀림=당일 재출제 · 맞힘=다음 날 · 2연속=3일 뒤 · 3연속=1주 뒤 · 4회+=2주~1달.
**본 횟수가 아니라 직접 회상 성공 여부**로 간격을 조절한다.

현행: WordStat{seen, wrong} + 마스터(⭐)만 존재. 연속 정답 수·타임스탬프·응답시간 추가 필요.

## 7. 기출 분석 자료 제작 시 추출 항목

출제 단어 / 숙어·구동사 / 동의어 치환 / 반의어 관계 / 논리 연결어 / 선지 패러프레이즈 / 빈출 콜로케이션 / 학교별 반복 출제 경향 / 오답 선지의 함정 유형.

## 8. 금지 사항

1. 단어와 뜻만 대량 나열
2. 예문 없이 추상적 뜻만 제공
3. 동의어 무차별 한 줄 나열
4. 완전 동의어와 문맥상 유사어 미구분
5. 회상 테스트 없는 읽기용 자료
6. 기출 문맥과 연결하지 않음
7. 출처 없는 조문·통계·사전 설명 임의 생성
8. 모르는 출처를 아는 척하지 않기

## 9. 최종 목표

단순 단어장이 아니라 **편입 영어 기출 기반 어휘 회상·분석·선지 판단 시스템**:
빠른 암기 / 잊은 단어 자동 재출제 / 기출 문맥 확인 / 동의어·반의어·패러프레이즈의 선지 판단 연결.
