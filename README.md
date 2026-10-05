# FINETUNE · 파인튠

필요한 것만, 필요한 순간에. 실제 풀이 기록으로 복습 우선순위와 반복 빈도를 조절하는 편입 어휘 학습 도구입니다.

현재 배포와 다음 작업은 `docs/WORKING_CONTEXT.md`, 기능 위치와 실행 명령은 `docs/DEVELOPMENT.md`를 기준으로 합니다. 검증은 `node scripts/verify-project.mjs`, Production 빌드는 `node scripts/build-production-web.mjs <새 빈 출력 폴더>`입니다.

## 호환성과 보안 경계

앱 표시명과 개발 패키지명은 FINETUNE입니다. 기존 설치와 학습 기록을 보존하기 위해 native bundle/package ID, OAuth scheme, Expo slug, `vocaknio_*` 저장 키, `vocanexus_*` 캐시 키 및 Pages `/vocaknio-quiz/` 주소는 유지합니다. 리브랜딩용 DB migration은 없습니다.

학습 기록은 브라우저/기기 로컬이며 새로운 적응형 상세 이력은 자동 계정 동기화되지 않습니다. 별도 서버의 sync API는 인증된 `ctx.user.id`만 사용합니다. Pages에 서버, 비밀 환경파일, 개인 학습 기록을 배포하지 않습니다.

정적 웹에서 기능에 필요한 단어 콘텐츠와 클라이언트 출제 코드는 다운로드 가능한 공개 자산입니다. 이를 비밀로 만들거나 복제 자체를 막는다고 보장하지 않습니다. 원본 개발 자료·비밀값·개인 기록은 공개 산출물에 포함하지 않으며 Production 감사에서 실패하면 배포를 중단합니다.

101~601·부록의 의도된 반복 출현과 기존 사용자 학습 상태를 유지합니다. 동일한 단어·품사·뜻의 검수 해설은 공유하고, 서로 다른 뜻은 합치지 않습니다. 사전 대조 근거와 자체 편집 정의·창작 예문을 구분합니다.
