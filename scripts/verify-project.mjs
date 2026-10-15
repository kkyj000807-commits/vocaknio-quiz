import { fileURLToPath } from "node:url";
import { runMonitoredNode } from "./lib/monitored-process.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
// Build data before tests: tests must inspect what the next export will ship.
const steps = [
  ["한글 발음 출처·증분 연결", "--import", "tsx", "scripts/build-korean-pronunciation.ts"],
  ["기출 원본 보존·검증 경계 감사", "--import", "tsx", "scripts/audit-exam-questions.ts"],
  ["Sentence Completion 등록·정답·근거 계약", "--import", "tsx", "scripts/audit-sentence-completion.ts"],
  ["학습 데이터 연결·검증", "scripts/build-vocab-learning-v1.4.mjs"],
  ["전 단어 영영 정의 데이터 감사", "scripts/audit-vocab-definitions.mjs"],
  ["canonical sense 공란 backfill·감사", "scripts/backfill-canonical-sense-content.mjs"],
  ["sense 문항 상태·목록 연결 검증", "--import", "tsx", "scripts/audit-sense-questions.ts"],
  ["영어 능동 인출 데이터·coverage 검증", "--import", "tsx", "scripts/audit-active-recall.ts"],
  ["전체 타입 검사", "node_modules/typescript/bin/tsc", "--noEmit"],
  ["전체 회귀 테스트", "node_modules/vitest/vitest.mjs", "run"],
];
for (const [label, ...args] of steps) {
  console.log(`\n검증: ${label}`);
  const kind = args.includes("--noEmit") ? "type" : "test";
  const result = await runMonitoredNode(args, {
    cwd: root, label, kind,
    focused: !args.includes("--noEmit") && !args.includes("run"),
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  "코드·데이터 검사 통과. Production 빌드·실제 브라우저·배포 확인은 별도입니다.",
);
