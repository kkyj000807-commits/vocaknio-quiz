import { spawnSync } from "node:child_process";
import path from "node:path";

const outputDir = process.argv[2];

if (!outputDir) {
  console.error("사용법: node scripts/build-production-web.mjs <빈 출력 폴더>");
  process.exit(1);
}

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).formatToParts(new Date());
const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
const releasedAtKst = `${value("year")}.${value("month")}.${value("day")} ${value("hour")}:${value("minute")} KST`;
const expoCli = path.join(
  process.cwd(),
  "node_modules",
  "expo",
  "bin",
  "cli"
);

console.log(`Production 빌드 시각: ${releasedAtKst}`);

const result = spawnSync(
  process.execPath,
  [expoCli, "export", "--platform", "web", "--output-dir", outputDir],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_PUBLIC_RELEASED_AT_KST: releasedAtKst,
      EXPO_PUBLIC_RELEASE_CHANNEL: "production",
    },
    stdio: "inherit",
    shell: false,
  }
);

if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
