import { spawnSync } from "node:child_process";
import fs from "node:fs";
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
const releaseConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "release.config.json"), "utf8"),
);
const releaseTarget = `${releaseConfig.version}|${releasedAtKst}`;
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
  [expoCli, "export", "--platform", "web", "--clear", "--output-dir", outputDir],
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

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const releaseManifest = {
  version: releaseConfig.version,
  modifiedAtKst: releasedAtKst,
  channel: "production",
  target: releaseTarget,
};

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

collectHtml(outputDir);
for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, "utf8");
  if (!html.includes("vocanexus-release-guard")) {
    fs.writeFileSync(htmlPath, html.replace("</head>", `${releaseGuard}</head>`), "utf8");
  }
}

console.log(`Production 릴리스 확인 파일: ${releaseManifest.target}`);
console.log(`자동 갱신 스크립트 적용 HTML: ${htmlFiles.length}개`);
