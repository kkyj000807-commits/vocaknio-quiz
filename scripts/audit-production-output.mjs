import fs from "node:fs";
import path from "node:path";

const outputRoot = process.argv[2];
if (!outputRoot || !fs.existsSync(outputRoot)) {
  throw new Error("사용법: node scripts/audit-production-output.mjs <Production 출력 폴더>");
}

const prefix = "/vocaknio-quiz/";
const files = [];
const collect = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else files.push(fullPath);
  }
};
collect(outputRoot);

const htmlFiles = files.filter((file) => file.endsWith(".html"));
const textFiles = files.filter((file) => /\.(?:html|js|css|json)$/.test(file));
const missing = new Set();
let rootExpoReferences = 0;
let rootAssetReferences = 0;

for (const file of textFiles) {
  const text = fs.readFileSync(file, "utf8");
  rootExpoReferences += (text.match(/["'=]\/_expo\//g) ?? []).length;
  rootAssetReferences += (text.match(/["'=]\/assets\//g) ?? []).length;
  if (!file.endsWith(".html")) continue;
  for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (!url.startsWith(prefix)) continue;
    const relativePath = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
    if (relativePath && !fs.existsSync(path.join(outputRoot, relativePath))) missing.add(relativePath);
  }
}

const release = JSON.parse(fs.readFileSync(path.join(outputRoot, "release.json"), "utf8"));
const learningDirectory = path.join(outputRoot, "data", "vocab-learning", release.version);
const learningFiles = fs.existsSync(learningDirectory)
  ? fs.readdirSync(learningDirectory).filter((name) => name.endsWith(".json"))
  : [];
const indexHtml = fs.readFileSync(path.join(outputRoot, "index.html"), "utf8");
const bundleUrl = indexHtml.match(/src="\/vocaknio-quiz\/([^\"]*entry-[a-f0-9]+\.js)"/)?.[1];
const bundle = bundleUrl ? path.join(outputRoot, ...bundleUrl.split("/")) : undefined;
const bundleText = bundle ? fs.readFileSync(bundle, "utf8") : "";
const result = {
  status:
    missing.size === 0 &&
    rootExpoReferences === 0 &&
    rootAssetReferences === 0 &&
    learningFiles.length === 8 &&
    bundleText.includes("vocab-learning") &&
    bundleText.includes("Wikimedia Commons") &&
    bundleText.includes("speechSynthesis")
      ? "pass"
      : "fail",
  release,
  htmlFiles: htmlFiles.length,
  missingReferences: [...missing],
  rootExpoReferences,
  rootAssetReferences,
  learningFiles: learningFiles.length,
  learningUiInBundle: bundleText.includes("vocab-learning"),
  americanPronunciationInBundle:
    bundleText.includes("Wikimedia Commons") && bundleText.includes("speechSynthesis"),
  bundle: bundle ? path.basename(bundle) : null,
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "pass") process.exit(1);
