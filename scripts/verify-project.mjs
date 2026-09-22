import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Build data before tests: tests must inspect what the next export will ship.
const steps = [
  ["학습 데이터 연결·검증", "scripts/build-vocab-learning-v1.4.mjs"],
  ["sense 문항 상태·목록 연결 검증", "--import", "tsx", "scripts/audit-sense-questions.ts"],
  ["영어 능동 인출 데이터·coverage 검증", "--import", "tsx", "scripts/audit-active-recall.ts"],
  ["전체 타입 검사", "node_modules/typescript/bin/tsc", "--noEmit"],
  ["전체 회귀 테스트", "node_modules/vitest/vitest.mjs", "run"],
];
for (const [label, ...args] of steps) {
  console.log(`\n검증: ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  "코드·데이터 검사 통과. Production 빌드·실제 브라우저·배포 확인은 별도입니다.",
);
