# FINETUNE 현행 스냅샷

## 2026-10-16 00:00 KST — 저장 안정화 통합 검사 완료 / 비공개 후보 빌드

기준 source5988fae. 웹12기존키 IndexedDB 원자적 이관(legacy 원문+별도원본copy 보존)/CAS/commit완료확인, 기존 native AsyncStorage 유지. 부분journal 복구·검증, stale migration backup의 최신목록 덮기 차단(22PASS), 독립북마크손상 분리, 실패코드/3회자동재시도/백업경로, lock취득전 응답보관과 순서drain, 다중탭 지연응답의 최신날짜·MASTER·마지막시각 역행 차단. 원시응답·누적횟수 보존. PR4 구현 재사용·보호검사 강화, workers_dev/preview_urls=false; 실제 Cloudflare 로그인과 Access설정 아직 필요. 기존 Pages와 브라우저기록은 변경하지 않음.

검증: pnpm verify 최종680PASS/1기존SKIP, 전체타입/데이터PASS; 앞선675PASS뒤 시간역행 추가수정으로 재검사. 중간실패는 Platform mock누락/응답보존 기대변경/1970년fixture 시각오류였으며 assertions삭제 없이 수정. 가용물리2316MiB시 exit75로 보류후 lint종료·3844MiB회복 확인하고 직렬재실행. 관련ESLint exit0/7warning(0error), security:audit exit0/0finding, diffcheckPASS. 실제Chromium IDB harness7PASS+20실제문서reload+중단journalreload+두실탭CAS PASS; store모듈20재접속도통과. 실기기iOS/Samsung·이후 전체앱Production 흐름·새배포는 별도미검증.

소유변경만 source커밋후 새 빈Production출력/감사/격리UI를 진행한다. IPA근사발음5891고유표제어/19021행과 기존미커밋UI·기본값 포함, 불확실발음보류/정답전힌트숨김. 이번저장작업의 신규콘텐츠생성0. 최종build/UI/backup/lock해제 및 후보SHA는 외부 A-latest.storageStabilizationCheckpoint 영수증. 공개배포는 Cloudflare 인증·본인1명Access·익명직접파일차단·실제Safari기록이관 확인 전 금지. 공개Pages source5988fae/표시1.0 그대로 유지, lastPassedCommit 승격하지 않음.

## 2026-10-15 23:42 KST — 저장 P0 수정·IndexedDB 실제 브라우저 검증 중 / 비공개 배포 전환

최신 요청으로 저장안정성 최우선. source5988fae/공개Pagesfb7ee76 일치 재확인. 현재 미커밋 발음·문풀 기본값·고밀도 UI 전부 보존, 잠금56340/PID27656 연속소유. 새 공개Pages 배포는 하지 않으며 PR4 security/private-safari-access의 Cloudflare Workers+Access 보호 목적지로 전환 중. PR4 fetch/연결 완료, 기존Pages 종료/저장소Private변경/실사용기록변경 없음. Cloudflare 대시보드는 로그아웃 상태로 사용자의 기존계정 로그인 필요. 인증 전 공개주소 활성화 금지.

수정 전 재현: 독립 북마크손상이 정답통계저장까지차단 + 조용한쓰기누락을저널성공처리 2FAIL27PASS → 수정후29PASS. migration 목록쓰기실패뒤완료marker만남음 등4FAIL6PASS →18PASS, stale migration backup이새탭목록덮음4FAIL18PASS→수정중. 웹12개기존키를 IndexedDB 한트랜잭션으로복사(원본localStorage불변/원본copy별도),CAS+commit완료대기, native기존AsyncStorage, 백업일관snapshot/원본3종복구출처 추가. 잠금5초취득상한/미실행응답보관/3회일시오류자동재시도, 충돌·형식오류무한재시도차단, 문풀오류단계분리. 사용자iPhone실제원인은미확정.

격리localhost26733 실제Chromium IndexedDB: legacy복사/CAS경합/중간quota·abort rollback/partialjournal/legacy충돌/권한거부 7PASS, 실제문서20회reload원문유지PASS. 가짜트랜잭션단위검사와구분. 실제iOS/Samsung·전체앱20회·새Production/배포는NOT_VERIFIED. 신규발음/설정/복구UI영향81PASS, 저장추가65PASS(중복합산하지않음). 타입검사초기test URL타입2오류→node:url명시수정, 최종검사대기. 전체검사3GiB자원게이트유지. 다음: 중단쓰기/두실탭검증→최종영향/전체verify/lint/security→소유source커밋→새Production/보호배포준비→Cloudflare인증/Access확인. 현행공개버전1.0유지.

## 2026-10-15 23:09 KST — 예문 배포 확인 / 한글 발음·문풀 기본값 구현 중

예문 배치 source5988fae / Pagesfb7ee76 / run38746789458 SUCCESS. 공개 release1.0/22:48:22KST/sourceDirty=false, JS SHA25696e7f9e7466b1e96f1ac072fcf03ccab529c4e1428fef9c218604867990054ad 로컬 일치. 현행·보존 판본 포함417개 공개 JSON/JS 대조PASS, skittish 신규영문·한국어·단서 실제공개표시 확인. 격리390x844 SC오답→reload→통계→동일유형복습정답→재접속1/2 유지. 실제모바일기기검증은아님.

새 요청: IPA 옆 작은 회색 한글 근사발음(철자추측금지/불확실보류/정답전숨김), 문풀 영어동의어→영영정의→논리 순/영어동의어 기본/전체 범위 기본/핵심·전체탭 제거. 사용자저장키·기록·정답·원본IPA불변. 잠금56340/PID27656 연속보유. 초기helper47PASS, 홈테스트1PASS1FAIL은 유지한 V101명칭의 '핵심'까지 금지한 과범위assertion으로 탭버튼만 검사하도록 수정. 새기능 생성·통합·빌드게이트는 아직 진행중이며 위예문 배포통과와 구분한다.

## 2026-10-15 — 신규 예문·번역·관계뜻 통합 중

22:47 KST 통합게이트 완료: 신규 창작129표제어/129sense/456동일뜻행, 번역72개, 관계뜻37개. 독립AI검수130초안 중129통과/1보류(perplexity),유전방향·번역강도 등3교정. 기존번역72개도 독립AI대조 후3표현교정. 신규예문held누적4,번역held누적11,관계held11. 사람검수/정답승격아님. 전수집계 EN8122→8251/13347,영한+단서194→394/13347;정의11611,원본38163행,심층112sense/111표제어불변. metadata와8섹션포인터검사/깨진연결0. 체크포인트analysis/qa/content-expansion-20261015.json/inputHash2129a13f5fc71d4e7030831cabe4977729139168f57f05dd5c31226d855f4683.

node scripts/verify-project.mjs exit0/타입·데이터PASS/554PASS1기존SKIP(93.96초,회귀samplepeak2714MiB),관련ESLint·pnpm security:audit exit0/0finding,diffcheckPASS. 정본·definition quiz·canonical·sense questions·active recall git diff0. 아래 중간검사 상태는 이력이며 현재 소유source커밋→새빌드→격리UI→공개배포 단계. 실제Safari/Samsung및사용자iPhone오류원인미검증을해결로보고하지않음.

기준27f8bf7/초기dirty0. 이전 자체잠금session32523 정상 Enter→exit0/LOCK_RELEASED 확인, 다른 프로세스·잠금파일 삭제 없음. 새 공통잠금56340/PID27656 보유. 이전 잠금제어 BLOCKED는 해소됐다.

원문 사전예문 번역·단서72개 추가(80→152), 기존 licensed 관계뜻37개 추가(43→80/27sense,11관계는 근거별held). 영어예문 없는 표제어의 자체작성 배치를 기존 사전 sense의 별도 editorialExamples 참고층으로 연결 중이며 원본 사전 인용·정답 승인과 구분한다. sourceRowIds에 포함된 동일뜻 행에만 표시하고 한국어는 펼침으로 유지한다. 기존 번역이 용례3번째 이후에 있어 숨던 adroit/as a matter of fact는 동일sense의 번역있는 원문을 먼저 표시한다.

생성 전 영향검사44PASS3FAIL(미반영 산출물), 생성 후47PASS/4files exit0. 신규 창작예문 독립 AI 의미검수 결과를 반영 중이며 최종 개수·전체검사·새 Production/공개 확인은 아직 미확정이다. 독립 사람 검수/전체완성/새 정답 승격 아님. 정본·학습 기록·저장키 불변. 다음: 의미검수 보류분 제외→생성·전수coverage→전체verify/lint/security→소유source커밋→새빌드/격리UI/공개배포. 상세상태 외부 A-latest.json currentManualCheckpoint.

## 2026-10-15 16:00 KST — 배포 정체 복구·예문 번역/동의어 뜻 공개 완료

공개 source `b817db503c74450ce531d6dc42b5503cf614a92a`, Pages `05efb7bcbaa3dffa8c01d363cfc49636f219050b`, 표시1.0/내부1.29/sourceDirty=false/빌드시각08:18:01 KST. 게시 run38695547128 SUCCESS(15:57 KST), 일반 공개 release 일치, entry-84f749a JS HTTP200/SHA256 `31e0fb94b29472d61b344ead753f0e237055ef329c95a1c2befafd658584f4fc` 빌드와 일치. 사전8/학습8 JSON 모두 HTTP200·의미동일(사전 파일의 Git 줄바꿈 정규화는 원시 해시 차이로 별도 구분). 첫 수동 공개대조 명령은 사전 경로를 1.29로 잘못 지정해 exit1; 실제 oewn-2025 경로 확인 후 재검사 exit0. 배포/앱 실패가 아니며 숨기지 않는다.

기존40→80개 OEWN 영한 예문(+40번역/+40문맥단서), 검수된11sense 관계뜻+43개. 고유 표제어13,347 중 영한+단서155→194(1.45%), 영어용례8,122(60.85%)/정의11,611(86.99%)는 불변. 신규 영어 예문40개나 심층해설40개가 아니라 기존 영어자료 번역·연결 보강이다. 심층112sense/111표제어 불변. AI 의미·품사 대조이며 독립 사람 검수 아님; 신규 출제 승인 없음. 새 held3/누적8, 영어예문 없는5,225표제어·사전 관계뜻대기8,267관계는 남는다.

전체549PASS·1기존SKIP/타입·데이터·관련ESLint·보안 PASS, 새 Production 빌드 exit0(1worker/samplepeak2133MiB), 출력감사 PASS. 동일 b817 입력으로 앞서 완료한 게이트 재사용, 반복 생성/빌드 없음. 격리localhost26731 IAB: SC오답0/1→새로고침 문항/선지/답안 유지→통계0/1→동일유형복습 정답1/1→재접속 통계1/2·논리오답1개 유지. 공개 IAB boast의 brag(자랑하다)/tout(과시하다), commensurate 원문→한국어 해석/단서 펼침 확인. 공개 사용자 답안/기록은 조작하지 않았다. 실기기 Safari/Samsung 및 실제 iPhone 저장 오류 원인은 NOT_VERIFIED.

기존 게시 정체는38595311982의 upload성공→updating_pages timeout→queued/jobs0였다. 동일 검증 SHA를 공식 Pages builds API로 한 번 재게시해38652097608 27초SUCCESS로 복구했다. GitHub 내부 원인은 미확정; 재빌드/RAM문제로 오인하지 않는다. 새 b817 배포는 정상 push만으로 성공, 추가 재게시 요청 없음. 복구는 이전 정상 Pages1f6c85a tree를 새 자식 commit으로 normal push하며 force/reset/학습기록초기화 없음.

상세 영수증: 외부 `2026-10-15-pages-recovery-content.json`, `A-latest.json`. 다음은 기존 섹션별 후보/held·입력해시에서 미처리 번역·개별관계뜻 배치를 이어간다. 완료80예문을 재생성하지 않는다. 아래 ‘빌드/배포 대기’는 이력이며 현행 상태가 아니다. 종료 백업·잠금해제 결과는 외부 영수증에 기록한다.

## 2026-10-15 08:16 KST — 게시 정체 복구 완료·번역/관계뜻 배치 검증 중

08:18 KST 배치 통합 검사 완료: 전체verify exit0, 타입PASS/549PASS·1기존SKIP(62suitePASS·1SKIP,104.75초,회귀samplepeak2745MiB), 관련ESLint exit0/보안762tracked0findings/diffcheckPASS. 정본·definition quiz·sense questions·active recall·canonical JSON 의미 동일 확인(행말 CRLF 차이는 의미 변경 아님). 아래 ‘현재 검사 중’은 중간 체크포인트이며 이제 source 커밋→새 Production 출력→격리UI·공개 확인 단계다.

기존 Pages38595311982는 첫 deploy updating_pages timeout 뒤 재시도가 약7시간 queued/jobs0이었다. cancel은 completed라며 거절되어 취소됐다고 처리하지 않았다. legacy/gh-pages 설정과 동일 검증SHA1f6c85a를 확인하고 공식 Pages builds POST를 1회 요청했다. 새 run38652097608은23:07:11~23:07:38Z(27초) SUCCESS. 공개 release source8cc9c0c/표시1.0/내부1.29/수정00:58:57/sourceDirty=false와 실제15912394바이트 JS SHA25629abcfe45acef6c04d78139c515f5832991f1f38509a82c3adbdb7fc901d338c 일치. IAB 홈·설정에서 새 시각과 실제 녹음 기본값 확인. GitHub 내부 원인은 미확정이나 앱 빌드·RAM 실패가 아닌 게시 작업 정체였고 재게시로 복구했다. 이전 ‘공개708d7bc 대기’ 문단은 이제 이력이다.

신규 배치: 기존 OEWN CC BY4.0 예문40개를 무변형 재사용해 자체 한국어 번역·문맥 단서 추가(기존40→80). 검수된11개 synset의 관계뜻43개 추가(capricious,boast,vie,callow 등). 의미·품사·원본 한국어 뜻을 AI 편집 검토했으며 독립 사람 검수/새 정답 승인 아님. blue-sky/ashamed/brunt 3개는 의미 충돌로 held에 추가(기존5→8). 정본38163행/13347표제어, ID/저장키/정답/quiz asset 불변. 깊이 해설112sense는 늘리지 않았으며 이 배치를 심층 해설 신규40개로 세지 않는다.

새 source→public 연결 회귀는 생성 전2FAIL29PASS → 생성 후35PASS/3files(exit0,9.88초). OEWN 기존 생성기3.46초/학습 생성기 exit0. 전체 coverage JSON analysis/qa/content-recovery-20261015.json 해시 f162f0c8f8a4b6db8784e5f51edab682707099c0ecae278eec6179df80309337: 영한+단서155→194표제어(1.45%), 영어용례8122/정의11611는 불변, 깨진 연결0. 40개 중1개는 다른 레이어에도 번역이 있어 고유 증가39. 사전층 뜻대기8267관계는 별도이며 심층층43개 추가를 그 수치에서 임의 차감하지 않는다. 전수 의미검수 완료 아님.

현재 전체verify 직렬 실행 중. 새 배치 Production은 아직 미배포이며 관련lint/security/전체회귀/커밋/새 빈 빌드/격리UI/Pages·공개 일치 확인 후에만 승격한다. 로컬잠금session32523/PID18576. 사용자 앱 종료/OS설정 변경 없음. RAM의 일시 감소 이후 기존 admission 물리3933MiB/commit41398MiB 허용을 확인하고 전체 검사 시작. 실제 iPhone 저장경고와 Safari/Samsung 실기기는 여전히 NOT_VERIFIED.

## 2026-10-15 01:17 KST — 검증 완료, Pages 게시 처리 대기

01:18 KST 게시 1차 실패: GitHub deploy가 updating_pages에서10분 timeout으로취소됐다. 빌드/artifact 업로드는 성공했고 공개708d7bc 유지. 코드/산출물 변경 없이 `gh run rerun 38595311982 --failed` 1회만 요청(exit0); 재시도 결과 확인 전 배포완료로 표시하지 않는다.

소스8cc9c0c85fad154cda2f3adc9e37bf1018a1ebbc를 현행 finetune-exam-stable-1-0에 normal push했다. 전체547PASS·1기존SKIP/타입·데이터·관련lint·Git보안 PASS, 새 Production dist-qa-usability-20261015-0100 exit0/출력감사 PASS. 표시1.0/내부1.29/수정2026.10.15 00:58:57 KST/sourceDirty=false. 빌드 samplepeak2456MiB. 아래의 이전 자원보류/미검증 문단은 작업 이력이며 이 체크포인트가 최신이다.

격리 localhost IAB에서 SC 오답→새로고침 동일문항·선지·답안 유지→통계0/1→정확유형 복습정답→재접속1/2/논리오답1개 보존을 확인했다. 390x844에서 긴 해설 아래 footer bottom836/scroll bottom777,320폭 가로이탈없음,1024태블릿 탭접근 확인. light/paper/dark 펼침 화면 확인. 백업 다운로드→같은 파일 검사: 동일9묶음/충돌0/추가0, 복원 버튼 비활성, 취소 후 기존 기록 유지. 실제 Safari/Samsung/가상키보드·회전은 NOT_VERIFIED. 공개 사용자 기록은 조작하지 않았다.

출력만 반영한 Pages1f6c85a7b8347113f826bc91ad8b44dc12c99cf2는 기존0ef945b의 새 자식 commit으로 normal push했다. GitHub run38595311982의 artifact 업로드 성공, 최종 Deploy 단계 진행 중이며 일반 공개 release는 아직708d7bc/2026.10.14 02:09:37이다. 공개 성공으로 승격하지 않는다. 새 공개 release·JS SHA·화면 확인 후 영수증 갱신. 실패 시 이전 정상 Pages0ef945b tree를 새 자식 commit으로 복원하며 force/reset/기록초기화 없음.

이번 신규 예문/번역/의미검수0. 검증된 짧은 관계뜻 표시와 기존 영어관계 누락 방지만 수정했다. boast의 개별뜻 미검수 상태를 임의로 채우지 않았다. 전체13,347표제어/38,163출현행 중 정의11,611(86.99%), 영어용례8,122(60.85%), 영한+단서155(1.16%). 예문없는5,225표제어·뜻대기8,267관계와 실제 iPhone 저장 보호 원인은 잔여 과제다. 구조집계 hash 불변 재실행 NO_CHANGE, 완료batch 재생성 없음.

## 2026-10-15 — 세션 보관 자동화·문풀 하단·개별 동의어 뜻 (배포 대기)

최종 입력 재검증: 자원 회복3290MiB 확인 후 verify exit0, **547PASS·1기존SKIP/62suitePASS·1SKIP**, 전체 타입·데이터PASS(97.95초). 이전 자원보류/중간 기대값 실패는 아래 이력으로 보존한다. 이 결과만으로 새 공개 배포를 뜻하지 않는다.

기준 branch `finetune-exam-stable-1-0`, HEAD5a58599, 로컬 잠금42617/PID6028. 예문만 바뀌어도 definition entry 전체 JSON 비교가 기존 세션을 막는 원인을 재현했다(수정 전 focused4FAIL23PASS). 예문은 채점 계약 비교에서만 제외하며 sense/정의/품사/관계어는 엄격 비교한다. 실제 구문항은 원본 raw를 기존 보관 키에 내구 저장한 후 최신 학습으로 이어진다. 저장 실패/깨진 원본은 그대로 보호하고 재시도·백업·설정 경로를 제공한다. 저장 실패 때 필터가 빠진 미저장 대체 문제를 만들던 catch도 제거했다. 과거 답안/선지/통계 재채점·삭제 없음.

문풀 이전/다음/결과 버튼을 긴 해설 ScrollView 밖의 일반 flex footer로 이동했다(absolute overlay/큰 임의 padding 없음). 공통 RelationChips에서 검증된 짧은 뜻은 영어 바로 옆 `(뜻)`으로 표시하고 긴/미검수 뜻은 펼침에 유지한다. 한국어 연결이 없다는 이유로 원자료 영어 동의어가 사라지던 경로를 보존형으로 수정하고 일반 정답 후 UI도 SynonymDetails를 재사용한다. 의미·정답/ID/저장키/사용자 기록 불변.

발음은 기존17개 녹음/라이선스·저작자 메타데이터와 공유 재생기를 유지한다. 저장 설정이 없을 때만 녹음 우선; 명시적 합성음 선택false는 보존. 녹음 실패→미국영어 합성음, 지연된 음성목록/수동 선택/취소 후 콜백 회귀를 확인했다. boast Commons 원문 CC BY-SA3.0/Neskaya 재확인; capricious 원문 도구 접근 실패, 전17원문 재검증/실기기 청취 완료를 주장하지 않는다.

전수 측정 `analysis/qa/usability-coverage-20261015.json` 입력SHA891fb948…aad: 13,347표제어/38,163출현행, 사전32,382sense/canonical125sense, 원본한국어뜻 누락0·깨진학습포인터0. 영어예문·용례8,122표제어(60.85%), 영한+단서155(1.16%), 예문없는5,225. 기존 사전관계 짧은뜻437건/1,281행, 뜻대기8,267관계. single3857/polysemous7053/idiom1877/unresolved560 구분. 1,594ms는 구조집계 시간이지 의미검수 생산성 아님. 신규 의미 콘텐츠/번역/검수 승격0. 기존 batch 재생성 없음; 전체 완성 아님.

검증: 발음 기본값 변경 전 전체 verify exit0/545PASS1SKIP·타입·데이터PASS(samplepeak2613MiB). 최종 발음 변경 뒤 focused15PASS, 관련 ESLint exit0, Git보안762tracked/0finding exit0, diffcheckPASS. 중간 기존 '합성음 기본' 테스트1FAIL은 최신 녹음우선 요구와 맞지 않는 기대값으로, 녹음기본/명시적합성음보존을 분리해15PASS 확인. 최종 verify는 데이터감사PASS 후 타입 진입에서 물리2987MiB<3072MiB로BLOCKED(exit1), 최종 전체PASS로 승격하지 않음. 공개1.0/2026.10.14 02:09:37/source708d7bc 유지. 새 Production 빌드·현재UI 브라우저·실기기·배포는 아직 NOT_VERIFIED. 가용 물리/commit 각각3GiB 회복 시 최종 verify→소유파일 커밋→새빌드/감사→격리브라우저→Pages 순서 재개. 사용자 iPhone 읽기보호 실제 원인은 여전히 미확정.

2026-10-14 23:37 KST 예약 A: **NO_CHANGE**. 로컬/원격 HEAD5a585994a8d2f4665e53569fdb69bd5bec77a50c, 시작 dirty0. 공개source708d7bc 이후 변경은 이 문서의 배포후 영수증뿐이며 앱·데이터 입력 변경 없음. 공개 release1.0/02:09:37/source708d7bc/sourceDirty=false와 JS HTTP200·Pages0ef945b blob SHA일치 재확인(exit0). 기존537PASS1SKIP를 새 검사 결과로 재계산하지 않고 전체 검사·생성·빌드·재배포 생략. 실제iPhone저장원인/실기기·5225표제어예문누락은 미완료 그대로. 잠금86913/PID34756, 백업/해제 결과는 외부 A-latest.json에 기록. 다음은 새 콘텐츠batch 또는 안전한iPhone오류코드 근거가 있을 때 해당범위 재개; 기록문서만으로 재배포하지 않는다.

## 2026-10-14 02:18 KST — 사전 예문 확장·40개 영한 예문 공개 완료

공개1.0 / 2026.10.14 02:09:37 KST / source708d7bcc591d0780a35bceb087c45a7c8a334f51 / sourceDirty=false / Pages0ef945b53cb14617bf8e465d7c0087c1dcfec3fd. GitHub Pages built, 일반 공개 release 일치, 새 entry-115177cf6018929b93e1bb58683f2799.js HTTP200+빌드SHA일치, 사전8섹션 HTTP200+Pages blob SHA일치+빌드JSON의미동일. 로컬 JSON 마지막CRLF가 Git에서LF로 정규화된1byte차이는 내용 불일치가 아님을8파일 모두 확인했다. 공개 IAB에서 abdicate 영어 예문→한국어 펼침/문맥단서와 새번들 로딩 확인. 공개 사용자 답변/학습기록 변경 없음.

전체537PASS·1기존SKIP/타입·데이터·관련lint·Git보안·새Production/출력감사PASS. 빌드samplepeak2064MiB. 격리localhost27815에서 실제 SC오답→새로고침 동일문항/선지/답안0/1→통계0/1→정확유형복습정답→결과1/1→재접속통계1/2·논리오답노트1개 보존. 새세션 정답위치3→4로재셔플. IAB실측390x844/scrollWidth390/하단탭bottom842에서 긴예문·KO펼침과 탭 접근 확인. 실제iPhone/Samsung·키보드·회전은NOT_VERIFIED, 기존사용자iPhone저장문제 원인미확정.

사전용례8056표제어/18999lexical sense/26230출현행, 모든층용례8122/13347표제어. 신규도달6057표제어, 기존객체용례만있던24개보류. 신규영한40표제어·40sense(AI대조검수, 독립사람검수아님). 원본38163행/정답·ID·저장키 불변. 영어용례없는5225표제어와 전체미번역/의미미검수는남음. 원본/사전참고/편집번역을구분한 content-pipeline·reasoning·release 스킬 적용; 사전참고확대를깊이해설완료로계산하지않는다.

다음: analysis/qa/examples-delivery-20261014.json 입력해시/held큐와 data/vocab-learning/reviewed-examples-20261014.json을기준으로 섹션별누락예문→번역→심층해설 재개. 완료batch재생성/문서만변경재배포금지. 복구는이전정상Pages4ca05ff의tree를새자식commit으로normalpush하며force/reset/학습기록초기화없음. 상세영수증: 외부2026-10-14-example-delivery-release.json/A-latest.json. 이문단은배포후문서기록으로공개sourceSHA와구분한다.

## 2026-10-14 — 전체 사전 용례 연결·40개 영한 예문 배치

배포 전 최종 verify exit0: 537PASS·1기존SKIP/62suitePASS·1SKIP, 타입·데이터 PASS, 95.22초/samplepeak2381MiB. 관련 ESLint exit0, Git 보안761tracked+1untracked/0findings, diff check PASS. 최초 검사에서 발견한 신규 예문 필드와 옛 fixture 불일치는 fixture 보완 및 잘못된 번역 연결 거부 검사 추가 후 해소했다. 아직 새 공개 배포를 뜻하지 않으며 최종 manifest·브라우저·Pages 결과는 후속 체크포인트로 남긴다.

로컬 잠금67393/PID14680. 사용자 요청은 예문 작업과 공개 배포. OEWN 원본 ZIP SHA7d749f6e…b51을 공식 주소에서 다시 확보해 기존 pinned hash와 일치 확인했다. 출제용 단일-sense 자산에만 있던 예문 경로를 전체 사전 lexical sense 참고층으로 확장했다. 8,056고유표제어/18,999lexical sense/26,230출현행에 원문 용례 연결; 기존 사전경로2,023표제어 대비 신규연결6,057(객체 예문만 있던24표제어 보류). 짧은 구·같은 의미군의 다른 단어 용례도 있으므로 전체 자연스러운 문장·한국어 뜻 정합성 검수 완료로 세지 않는다.

전체 데이터의 예문/용례 도달 가능 범위는8,122/13,347표제어, 영한+단서 tuple155표제어. 40개 표제어/40sense/40원문 예문에 자체 한국어 해석·문맥 단서를 추가하고 원본행/사전ZIP/공개JSON 각각40/40대조. 독립 사람 검수 아님; 정답 승격 없음. 영어 먼저, 한국어 펼침, 용례2개 이후 더보기. capsize 경고문 번역의 조건 연결을 '흔들면'으로 명확화했다. 원문에 별도 출처가 달린 object 예문은 권리 재검토 전 제외하여 Python dict문자열 노출도 차단했다.

기존 quiz4114표제어/11360행·정답·원본38163행·저장키 불변. generator 재실행3,983ms/10개산출물 hash+mtime불변. `analysis/qa/examples-delivery-20261014.json`에 전체 섹션별 집계/잔여queue/입력해시 저장. 원문과 맞지 않는annuity/call it quits/bottle up 등5항목은 배치held, 전체 영어용례없는5,225표제어는 남은 보강 대상. 중앙DB연결미확인 sync_required. 통합 검증/빌드/공개 확인 결과는 이 회차 외부 release 영수증에 이어 기록하며 이 문단만으로 배포 완료를 뜻하지 않는다.

2026-10-14 01:31 KST 예약 A: **NO_CHANGE**. 로컬/원격 source3f26d78은 공개841fbdd 이후 이 문서 기록만 추가됐고 앱·데이터 입력과 초기 working tree는 변경 없음. 공개1.0/01:21:16/source841fbdd/Pages4ca05ff 및 실제 JS HTTP200 재확인. 전체 검사·빌드·재배포 생략, 기존 실패·실기기 미검증 상태 유지. 세부 명령/잠금/백업 결과는 외부 A-latest.json latestHeartbeatCheckpoint에 기록하며 이 체크포인트 자체를 새 배포 이유로 삼지 않는다.

## 2026-10-14 01:26 KST — 영어 우선 UI·FT 브랜드 공개 확인 완료

현재 공개 **1.0 / 2026.10.14 01:21:16 KST / source841fbdd8cfc601dc22fca7e3d906a4a39d09e448 / sourceDirty=false / Pages4ca05ff03cf3a79459a1e588ff15307486e3ca60**. GitHub Pages built, 일반 release URL 일치, 공개 JS/Apple180/공유512/favicon/V101 학습JSON의 SHA-256이 감사 산출물과 모두 일치했다. 공개 IAB 홈 FT로고·실제 entry-829f97c87856ccfd11d8eac3ccbac95f.js 로딩 확인, 사용자 공개 답변·개인 기록 조작 없음.

영어 동의어/예문 우선 + 한국어 해석·뜻·단서 펼침, 압축 문제 상단,15sense 누적 콘텐츠, 시작 오류 고정코드/백업 export-only, 제공 FT아이콘(홈/파비콘/Apple/공유) 반영. 별도 native 설치 앱 출시나 메신저 캐시 즉시 갱신을 주장하지 않는다. 전체534PASS·1기존SKIP/타입PASS, 영향회귀7PASS, lint/security761tracked0findings, 새 빌드/Production 감사PASS(pagesStaticServing=true). 전체회귀91.15초/samplepeak2,342MiB, 빌드130.52초/samplepeak2,070MiB.

중간배포에서 `.nojekyll` 누락으로 JS404를 발견했고 정상판으로 normal commit 복구 후 생성기/감사/회귀를 고쳐 새로 빌드·배포했다. 실패 이력은 아래와 외부 영수증에 보존한다. 이번 최종 공개에서는 JS200+SHA/로고 확인을 통과했다.

실제 관찰한 IAB 좁은 화면은374px, 공개 홈은 데스크톱이다. 지정320/390 override는 실제 미적용으로 NOT_VERIFIED. 실제 iPhone/Samsung Internet·키보드/회전 검증 및 사용자의 iPhone 저장 실패 원인은 여전히 미확정이다. 보호 경고가 지속되면 새 고정 오류 코드부터 확인하며 데이터 삭제·초기화를 안내하지 않는다.

전체13,347표제어·38,163출현행 원본SHA불변. deep111표제어/112sense/310행이며 전체 콘텐츠 완성을 주장하지 않는다. 다음은 기존 섹션별①영어 예문·관계어②번역③깊이해설 queue를 입력해시 기준으로 재개, 완성batch 재처리 금지. 외부 `2026-10-14-english-first-release.json`과 A-latest에 명령/출력/복구경로/잠금 해제 영수증 보존. 이 문단은 배포 후 문서 기록이며 공개 source SHA와 구분한다.

## 2026-10-14 01:18 KST — 공개 검증에서 Pages 정적 파일 제외 발견·정상판 복구

543292d 후보는 전체534PASS/빌드/로컬UI를 통과했지만 gh-pages bceaf47 반영 후 새 JS가HTTP404였다. 새 출력에 `.nojekyll`이 없었고 이전 정상판9e5a0ff에는 있었다. Jekyll의 `_expo` 제외를 기존 로컬 참조 감사가 검사하지 못했다. 즉시 이전 정상 출력 tree를 새 자식 commit8d8955d로 normal push해 복구 요청했다(force 없음/기록 변경 없음). 이 후보를 공개 성공으로 보고하지 않는다.

createPagesFallback가 `.nojekyll`을 항상 생성하고 Production 감사가 marker 누락을 실패시키도록 수정했다. 기존 테스트에 회귀 추가: 수정 전1FAIL1PASS, 수정 후 결과/재배포는 외부 영수증으로 기록한다. 전체 입력 재검증·새 clean SHA 빌드·원격 JS HTTP/SHA까지 다시 확인한다.

IAB viewport 정정: 320/390 override를 요청했으나 실제 DOM은374x607이었다. 앞선 요청 폭을 실제 검증 폭으로 해석하지 않는다. 실제 좁은 IAB 렌더와 흐름만 확인했으며 iPhone/Samsung/지정320·390은 NOT_VERIFIED다.

## 2026-10-14 — FT 표지 통합 릴리스 게이트

사용자 제공 남색 FT 디자인을 이미지 파생본/홈 로고/웹 favicon/Apple 홈 화면 아이콘/공유 OG로 연결했다. 홈은 작은56px 로고와 FineTune 워드마크이며 원본 콜라주를 거대한 표지로 넣지 않는다. 공개 웹 아이콘과 native 설정 변경을 실제 네이티브 앱 출시로 혼동하지 않는다. BRAND_ASSETS에 출처·생성/크기 변환을 기록했다.

전체 verify exit0: 534PASS·1SKIP/62suitePASS·1SKIP, 타입 PASS,94.12초, sample peak private3,107MiB. 관련 ESLint exit0, Git보안753tracked+8untracked/0findings, diff check PASS. 선행4744653 clean 빌드/감사PASS. 격리 localhost27814 IAB390에서 실제 논리오답→새로고침 동일문항/보기/답안 유지→통계0/1→정확문항 복습정답→결과1/1→재접속 통계1/2·논리오답1개 보존 확인. 실제공개/iPhone사용자 기록은 수정하지 않았다.

새 브랜드 입력의 최종 clean 빌드/공개 검증은 다음 게이트다. 이 기록만으로 배포 성공으로 간주하지 않는다. 외부 최종 영수증/A-latest 참조. 실제 iPhone Safari·Samsung Internet은 NOT_VERIFIED이며 저장보호 원인 미확정, 전체 콘텐츠 미완료 상태는 유지한다.

## 2026-10-14 — 영어 우선 표시·압축 레이아웃 공개 후보

사용자 최신 요청: 업데이트는 공개 Pages 배포까지이며, 콘텐츠 전체 완료를 기다리지 않고 검증된 UI/기존 누적 수정부터 릴리스한다. 표시1.0/내부학습1.29 유지. 로컬 `C:/Users/USER/Projects/FINETUNE` 잠금42606/PID29192에서 작업.

- 공통 RelationChips는 영어 칩을 먼저 표시하고 한국어 개별 뜻·긴 차이는 별도 펼침으로 보존한다. KoreanReveal은 영어 예문 아래 해석·단서를 기본 닫힘/44px 조작으로 제공한다. 단어장·정답 후 해설의 공통 경로 적용, 의미/정답/ID/저장키 변경 없음.
- 문제 상단 큰 통계 카드3개와 반복 제스처 안내를 정리했다. 정답·오답·새 문제를 한 줄에, 진행은 기존 분수/진행선에만 표시한다. 카드 내부24→16px. safe-area/동적viewport 기존 구현을 유지하며 실기기 해결을 단정하지 않는다.
- 기존 소유 시작 오류 구분/백업 내보내기와 15sense 보강도 이번 누적 후보에 포함한다. 사용자 iPhone 원인은 여전히 미확정이며 시작 보호를 우회하지 않는다.
- 콘텐츠 후속 공정은 섹션별 ①예문·관계어 확보 ②한국어 번역 ③상세 해설 순이다. 단계별 체크포인트/입력해시를 재사용하고 기존 우수 내용을 덮지 않는다. 이번 UI 릴리스를 전체13,347표제어 보강 완료로 세지 않는다. 미검수 후보는 정답 자료로 승격하지 않는다.
- 검증/공개 판본의 최종 영수증은 외부 `2026-10-14-english-first-release.json` 및 A-latest에 저장한다. 이 문단 자체는 배포 성공 판정이 아니다.

## 2026-10-14 00:50 KST — 로컬 전환 검증 통과·백업 준비, 새 배포 아님

새 로컬 `C:/Users/USER/Projects/FINETUNE`에서 `node scripts/verify-project.mjs` exit0: 데이터/전체 타입 PASS, 61개 suite PASS·1SKIP / 532테스트 PASS·1SKIP, 회귀88.67초. 실측 sampled peak private 타입1,207MiB/회귀2,848MiB. `pnpm security:audit` exit0/750tracked+2untracked/0findings. 1worker `node scripts/build-production-web.mjs audit-output-local-20261014-0050` exit0, Expo bundle 약111초/샘플peak2,133MiB, 자동 Production 출력 감사 PASS(누락참조0/보안0/학습JSON일치). QA manifest1.0/source34e3de43/sourceDirty=true/00:47:12KST: **dirty 로컬 검증물이며 공개 배포하지 않음**. 실제 브라우저/실기기 미검증.

OneDrive만 사용자 승인 후 재시작했고 테스트·빌드 뒤 가용RAM4,218MiB/전체commit20.56GiB, OneDrive전용933MiB·handles10,213. 초반401MiB보다 증가했으므로 내부 누수 해결·장기 무재발을 확정하지 않는다. 기존41GiB점유가 아닌 상태에서 실제 전체검사/빌드는 통과했다. 다른 앱 종료·페이지파일/heap 변경 없음.

기존 원자료/QA 631파일을 `C:/Users/USER/Projects/FINETUNE-reference`로 별도 복사해 해시 불일치0 확인. 앱 자료와 자동 병합하지 않았다. 관련 데이터/사전캐시/검수/생성/테스트/빌드는 로컬에서 처리한다. 기존4개 예약도 로컬로 전환했고 주기/상태/대상대화 일치 재확인. A의 하루1회 변경분 백업은 외부 local-backup.py를 재사용하며 클라우드 업로드를 개발 대기조건으로 삼지 않는다. 백업 fixture4개 PASS(미커밋/미추적·Git복원, 중복생략, 경로격리, 클라우드실패 후 로컬보존·재시도). ZIP/실제 첫 복사 결과는 외부 backup-latest.json 참조.

다음: 현재 소스/데이터의 공개 전 격리 브라우저 게이트와 사용자 iPhone 원인 진단은 여전히 필요하다. 환경 작업을 콘텐츠 확장 완료로 세지 않는다. 활성 deep111표제어/112sense, 전체13,347표제어의 미보강 범위는 이전 큐에서 대량 처리한다. 최신 로컬 dirty를 옛 worktree로 덮거나 동시에 개발하지 않는다.

## 2026-10-14 00:44 KST — 로컬 개발 전환, 검증 진행 중

활성 작업 경로는 **C:/Users/USER/Projects/FINETUNE**이다. 기존 OneDrive main과 finetune-audit-trial은 원본/복구용으로 보존하며 개발을 재개하지 않는다. 같은 branch `finetune-exam-stable-1-0`, HEAD `34e3de436b240b706235fbda9b9b9dc1e8fb4bab` 및 이전 소유 dirty 25+untracked2개를 보존했다. 최초 소스752·의존성51,834파일 SHA-256 불일치0, HEAD/status/staged 동일, git fsck connectivity PASS. `.git`와 node_modules는 독립 로컬 실체이며 Git alternates/의존성 junction 없음. pnpm virtualStoreDir만 로컬 경로로 수정했다. 재설치/원본 삭제/사용자 기록 변경 없음.

OneDrive PID22892 정상종료 응답 없음 → 사용자 별도 승인 후 해당 PID만 강제종료·background 재실행(PID32104). 직전 전용41.447GiB/전체commit60.399GiB/RAM가용1236MiB → 재실행5초 전용0.031GiB/commit19.080GiB/가용3373MiB. 이후 전용약401.5MiB/가용약4.7GiB. 직접적인 압박 해소는 확인했으나 내부 원인·장기 재발 여부는 미확정이다. 사용자 앱 종료를 예약에 자동화하지 않는다.

기존 A/B/C/D 예약의 경로를 목적 도구로 로컬에 전환(주기/권한/ID 보존). 원본 잠금26782/PID27088과 로컬 잠금95523/PID26280을 사용해 복사·전환했고 해제 결과는 외부 보고서에 기록한다. 1worker whole verify를 로컬에서 실행 중이다. 공개판/배포 상태는 이전과 같으며 환경 전환을 공개 앱 수정으로 보고하지 않는다. 최종 결과는 아래 후속 기록과 외부 `2026-10-14-local-migration.json` 참조.

## 2026-10-14 00:30 KST — 영한 콘텐츠 15sense 실제 추가·저장 회귀 검증, 미배포

기준34e3de43/동일 통합 작업실. 기존 시작복구9개 코드·테스트와 main 사용자 dirty를 보존했다. OS 잠금2565/PID16456; 종료 영수증은 외부 A-latest. 원본38,163출현행/13,347고유표제어 SHA `7eba20f388d04e9d7fb10edec635beac5dc7a6c726ef6e25d7daba4ce57908dd` 불변. 사용자 기록·정답·ID·원본 뜻 수정 없음.

- `reviewed-batch-20261014.json`: abhorrent/abiding/abolish/abominate/abundant/acclimate/accomplice/accountant/acquiesce/adage/adore/adroit/altercation/altruistic/ambivalent의 명시 sense15개에 자체 편집 영영·한국어 정의, 창작 영한 예문15개, 문맥 단서, 구문·오답 주의, 짧은 관계어 뜻25개를 추가했다. OEWN2025와 TFD(AHD/Collins) 또는 Collins 직접 페이지를2026.10.14 대조했다. 사전 원문 예문 복제 없음; AI 출처 대조 편집이며 독립 사람 검수 아님. 새 정답 문항 승격0.
- 기존 builder→index→public group→LearningDetails에80행 연결. 깊이 학습 **96→111고유표제어 /97→112고유sense /165→180출력항목 /230→310연결행**. 반복 출력항목을 sense로 표시하던 집계를 수정했다. canonical110→125sense/253→333행, 필드 COMPLETE92→107·NEEDS_REVIEW18유지. COMPLETE는 자동 필드 완비이며 의미 전수 보증이 아니다.
- deep SenseDetails에서 공통클러스터로 개별 한국어 뜻을 전달하지 않던 경로 수정. 영어(짧은뜻)·유사어·상세펼침 보존. 미완료9표제어 및 ambivalent/altercation의6행은 private `analysis/qa/reviewed-batch-20261014-held.json`에 저장했다. 전체13,347개 완료 아님.
- native 연결·수량검사 수정 전2PASS2FAIL→4PASS. deep 렌더28PASS·데이터17PASS. 기존 시작복구의 저장23/이관6/백업10/UI4=43PASS. 전체 실행527PASS5FAIL1SKIP의 실패는 backup mock두곳의 새키 누락4건과110개 고정 baseline1건. 실제키를 모형에 추가하고 신규15개를 분리한 뒤 **기존110개 콘텐츠 SHA를 변경 없이 대조**, 해당3suite40PASS. 타입은 직전 PASS이나 최종 mock상수 추가 후 재검증은 보류.
- 최종 `verify-project.mjs`: 앞선 데이터 게이트 PASS, type admission 물리3068MiB<3072로exit1 BLOCKED_RESOURCE. 이후 물리2564MiB/commit4498MiB. 변경19파일 lint exit0/오류0·기존배열표기경고4, pnpm security:audit exit0/검출0. 동일 generator 재실행469ms, 주요4출력 hash/mtime불변. 테스트 시간을 의미 검수 생산량으로 계산하지 않았다.
- 공개00:29재확인: **1.0/source095ee969/2026.10.13 01:48:14KST/dirtyfalse/학습데이터1.29**. 새 Production·격리브라우저·실기기·배포 미실행. 아이폰 실제 원인·해결 미확인. 전체최종PASS나 배포완료로 표시하지 않는다. 자세한 명령·경계는 외부 `2026-10-14-content-and-startup-validation.json`.

**다음:** 이번 소유 미커밋/시작복구 패치를 보존. 물리+commit각각3GiB 회복 시 보류 게이트인 monitored type/full regression부터 재개(입력불변 데이터 감사 반복 불필요). 통과 후 명시stage/security/source커밋→새빈Production/감사→격리학습·재접속→승인Pages·공개 확인. 완료15개는 재작성하지 않고 private OEWN stage와 보류큐에서 다음 batch를 처리한다.

23:19 KST A 점검: 후보34e3de43와 소유 시작복구9개 코드/테스트 패치는 불변, 원본 main 사용자 변경 보존. 가용 물리537MiB/commit7,167MiB·active heavy0으로 영향검사768MiB와 전체3GiB 조건 미달. 검사·빌드·배포 반복0, 기존 FAIL/BLOCKED/NOT_VERIFIED 유지. 실제 원격main1bf27b98/Pages9e5a0ffb·공개1.0/source095ee969/01:48:14KST/dirtyfalse 재확인. checkpoint만 저장하며 다음은 자원 회복 후 기존 시작복구 영향검사부터 재개한다. 잠금79939/PID10396, 해제 영수증은 외부 A-latest. iPhone 원인/해결 및 새 공개 반영은 미확인이다.

21:24 KST A 점검: 시작 복구 후보9개 코드/테스트와 문서의 기존 미커밋 변경을 보존했고 새 코드 수정0. 가용 물리699→450MiB/commit8,584→8,413MiB, active heavy0. 영향검사768MiB·전체검사/빌드3GiB에 미달하여 동일 입력 검증을 반복하지 않았다. 원격34e3de43/main1bf27b98/Pages9e5a0ffb와 공개1.0/source095ee969/01:48:14KST/dirtyfalse를 재확인했다. 배포 BLOCKED_RESOURCE, 기존 미통과 게이트·iPhone 원인 미확정 유지. 잠금99730/PID31076으로 checkpoint만 저장한다. 다음은 메모리 회복 후 migration/backup/store 영향검사부터 재개하며 종료 LOCK_RELEASED 영수증은 외부 A-latest에 기록한다.

19:20 KST A 점검: 18:12 시작 복구 대응9개 코드/테스트와 checkpoint 문서는 소유 확인된 미커밋 그대로이며 추가 코드 변경0. 가용 물리637MiB/commit10,983MiB, active heavy0. focused768MiB·전체3GiB 조건 미달로 미통과 Vitest/type/lint/build는 재시도하지 않았고 이전 isolated5검사·syntax/security 결과를 전체 통과로 승격하지 않았다. 원격34e3de43/main1bf27b98/Pages9e5a0ffb·공개1.0/095ee969/01:48:14KST 재확인. 사용자 iPhone 원인·수정 효과는 미확인, 진단/백업 UI 패치도 아직 미배포다. 잠금23581/PID13024로 이번 기록만 저장; 해제는 A-latest 영수증. 다음 우선순위는 아래 시작복구 관련 focused 검증이며 기존 완료 batch는 반복하지 않는다.

## 2026-10-13 18:12 KST — 사용자 iPhone 시작 실패: 원인 안내·복구 백업 후보, 미배포

사용자가 공개판에서 `학습 기록을 불러오지 못했습니다` 화면을 보고했다고 확인했다. 공개 HTML/JS/CSS/quiz/wordbook HTTP200, IAB 새 탭 첫 화면 표시와 iPhone UA HTTP200은 확인했으나 실기기 저장 실패 원인은 미확정이다. `app/_layout.tsx`가 migration/journal 실패를 같은 문구로 가리고 백업이 있는 설정 진입까지 막는 경로를 확인했다. 원본 기록·버전키·정답·저장 차단은 그대로 유지한다.

소유 변경: vocab-storage-migration에 고정 오류 코드(접근 거부/읽기/공간 부족/쓰기/형식), store에 journal 실패 구분; root의 원본 오류 console 출력 제거·스크롤 가능한 시작 안내·기존 LearningBackupSettings의 exportOnly 경로 연결. 시작 화면에서 복원/덮어쓰기 입력은 제공하지 않는다. 기존 exportLearningBackup에 원본 migration backup을 선택 필드로 보존하고 자동 restore 대상으로 쓰지 않는다. 기존 백업 형식과 구버전 백업 호환 유지. 공개 실패를 임의 bypass하거나 손상/원인 해결로 확정하지 않았다.

검증: 실제 작은 migration 모듈+격리 adapter에서 기존3FAIL→3PASS(접근/형식/quota; 원본 보존), 실제 백업 UI SSR1PASS(exportOnly/자동 호출0), 실제 store의 격리 export1PASS(legacy/journal 원문 보존·복구실행0·쓰기0). 변경9개 TS/TSX syntax0errors, Git보안750tracked/0findings, diff check PASS. 이는 전체 타입·실제 브라우저 검증이 아니다. 새 회귀는 기존 migration/backup UI/store/backup 테스트에 추가했다. focused Vitest 시도는 가용632MiB<768로 exit75; 끝663MiB/commit11,930MiB라 전체3GiB 게이트 미충족, lint/전체verify/빌드/공개배포 보류. 공개1.0/source095ee969/01:48:14KST 유지. 이번 변경이 아이폰에 반영됐다고 보고하지 않는다.

기준34e3de43, OS잠금6879/PID9848. 이전 checkpoint 문서와 이번9파일 패치는 이 대화 소유 미커밋이며 main dirty는 수정하지 않았다. 다음: 새4개 관련 Vitest/저장journal회귀→타입/lint/전체verify→깨끗한소스의 새빌드/출력감사→격리 시작실패/백업/재시도와 기존학습흐름→공개확인. iPhone에서는 오류 코드 확보 전 데이터 삭제 금지; 직접 사이트 저장값/개인 백업은 공개하거나 로그에 넣지 않는다. 잠금 해제 영수증은 A-latest에 기록한다.

17:19 KST A 재확인: 동일 후보34e3de43·공개095ee969/1.0/01:48:14KST, 소유 확인된 checkpoint 문서만 dirty. 가용 물리546MiB/commit13,666MiB, active heavy0. 전체3GiB와 영향768MiB 기준 미달, unchanged native 검사도 반복하지 않음. 코드/데이터 변경0, 전체verify·빌드·UI·배포 보류, lastPassed095ee969 유지. 잠금73005/PID15128 아래 상태 기록만 저장. 다음 조건/게이트 동일, 해제 영수증은 A-latest에 기록.

15:19 KST A 재확인: 후보34e3de43·원격·공개095ee969 모두 동일, 이전13:24 checkpoint만 소유 확인된 미커밋 변경이다. 가용 물리1,139MiB/commit15,023MiB, 실행 중 heavy검사0으로 전체3GiB 조건 미충족. 기존 영향검사는 입력 불변으로 재실행하지 않고 전체검사/빌드/배포 BLOCKED_RESOURCE 유지. 신규 코드·콘텐츠·사용자기록 변경0. 잠금89154/PID14880으로 이번 상태만 저장하고 최종 해제 영수증은 외부 A-latest에 기록한다. 재개 조건과 남은 게이트는 아래와 동일하다.

## 2026-10-13 13:24 KST — A 예약: 동일 후보, RAM 미회복으로 배포 보류

통합/원격 `34e3de43`는 시작 시 clean, main `1bf27b98` 사용자 변경과 Pages `9e5a0ffb`는 보존됐다. 공개 release.json은 **1.0 / 01:48:14 KST / source095ee969 / sourceDirty=false / learningData1.29**로 재확인했다. CIM 가용 물리 RAM **1,067→827MiB**, 가용 commit **15,842→15,654MiB**로 전체 검사·빌드의 각각3,072MiB 기준에 RAM이 미달했다. 명령 분류상 Vitest/tsc/Metro/Expo export 실행0개. 다른 Node를 테스트 worker로 세거나 사용자 프로그램을 종료하지 않았다.

코드·자료 입력 변화0. 기존 통과 영향 검사는 재사용하며 전체 verify/type·Production·격리UI·배포는 **NOT_RUN_RESOURCE/NOT_VERIFIED/BLOCKED**다. 중간 후보523PASS를 최신 전체 통과로 승격하지 않는다. 신규 구현·의미검수·배포0, lastPassedCommit095ee969 유지. 잠금13224/PID3056 아래 checkpoint만 저장하고 종료 Enter/LOCK_RELEASED 영수증을 외부 A-latest에 남긴다. 다음은 물리/commit 각각3GiB 회복 후 아래 후보의 남은 전체 게이트부터 직렬 재개한다. 동일 저메모리 실패나 완료 데이터 batch를 반복하지 않는다.

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
