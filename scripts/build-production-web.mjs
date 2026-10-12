import fs from "node:fs";
import path from "node:path";
import { createPagesFallback, requireEmptyOutput } from "./lib/production-output.mjs";
import { createReleaseMetadata } from "./lib/release-metadata.mjs";
import { readSourceState } from "./lib/source-state.mjs";
import { runMonitoredNode } from "./lib/monitored-process.mjs";

const outputDir = process.argv[2];

if (!outputDir) {
  console.error("사용법: node scripts/build-production-web.mjs <빈 출력 폴더>");
  process.exit(1);
}

const preflight = await runMonitoredNode([], { kind: "build", label: "Production admission", admissionOnly: true });
if (preflight.status !== 0) process.exit(preflight.status);
requireEmptyOutput(outputDir);
const runTask = async (label, args) => {
  const task = await runMonitoredNode(args, { label, focused: true });
  if (task.status !== 0) process.exit(task.status);
};
await runTask("exam audit", ["--import", "tsx", "scripts/audit-exam-questions.ts"]);
await runTask("SC audit", ["--import", "tsx", "scripts/audit-sentence-completion.ts"]);
const builtAt = new Date().toISOString();
const dataVersion = JSON.parse(fs.readFileSync("assets/vocab-meta-v1.4.json", "utf8")).version;
await runTask("sense audit", ["--import", "tsx", "scripts/audit-sense-questions.ts"]);
await runTask("learning build", ["scripts/build-vocab-learning-v1.4.mjs"]);
await runTask("definition audit", ["scripts/audit-vocab-definitions.mjs"]);

const releaseConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "release.config.json"), "utf8"),
);
const releaseManifest = createReleaseMetadata(releaseConfig, {
  // Generators above can change data after checkout. Observe their actual result,
  // including new files that git diff --quiet does not see.
  ...readSourceState(), dataVersion, builtAt,
});
const releasedAtKst = releaseManifest.modifiedAtKst;
const releaseTarget = releaseManifest.target;
const expoCli = path.join(
  process.cwd(),
  "node_modules",
  "expo",
  "bin",
  "cli"
);
console.log(`Production 빌드 시각: ${releasedAtKst}`);

const result = await runMonitoredNode(
  [
    expoCli,
    "export",
    "--platform",
    "web",
    "--clear",
    "--output-dir",
    outputDir,
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EXPO_PUBLIC_RELEASED_AT_KST: releasedAtKst,
      EXPO_PUBLIC_RELEASE_CHANNEL: "production",
    },
    kind: "build", label: "Expo Production export",
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

fs.writeFileSync(
  path.join(outputDir, "release.json"),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  "utf8",
);

const releaseGuard = `<script id="vocanexus-release-guard">(()=>{const current=${JSON.stringify(releaseTarget)};const manifest="/vocaknio-quiz/release.json";const key="vocanexus_release_reload_target";const isQuiz=()=>/\\/(quiz|wrong-quiz)\\/?$/.test(location.pathname);async function check(){if(isQuiz())return;try{const response=await fetch(manifest+"?t="+Date.now(),{cache:"no-store"});if(!response.ok)return;const next=await response.json();if(!next.target||next.target===current)return;let attempted="";try{attempted=sessionStorage.getItem(key)||""}catch{}if(attempted===next.target)return;try{sessionStorage.setItem(key,next.target)}catch{}const url=new URL(location.href);url.searchParams.set("release",next.target.replace(/[^0-9A-Za-z.-]/g,"-"));location.replace(url.toString())}catch{}}window.addEventListener("pageshow",check);window.addEventListener("focus",check);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check()})})();</script>`;

const htmlFiles = [];
const collectHtml = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(fullPath);
  }
};

createPagesFallback(outputDir);
collectHtml(outputDir);
for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, "utf8");
  if (!html.includes("vocanexus-release-guard")) {
    fs.writeFileSync(htmlPath, html.replace("</head>", `${releaseGuard}</head>`), "utf8");
  }
}

console.log(`Production 릴리스 확인 파일: ${releaseManifest.target}`);
console.log(`자동 갱신 스크립트 적용 HTML: ${htmlFiles.length}개`);

const audit = await runMonitoredNode(["scripts/audit-production-output.mjs", outputDir], {
  cwd: process.cwd(), label: "Production output audit", focused: true,
});
process.exitCode = audit.status ?? 1;
