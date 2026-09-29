import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const run = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const list = (args) => run(args).split("\0").filter(Boolean);

const tracked = list(["ls-files", "-z"]);
const untracked = list(["ls-files", "--others", "--exclude-standard", "-z"]);
const sensitiveName = /(^|\/)(\.env(?:\.|$)|(?:credentials?|secrets?|passwords?|tokens?)(?:[-_.].*)?\.(?:json|ya?ml|toml|txt)?$|.*\.(?:pem|key|p12|pfx|sqlite3?|db|dump))$/i;
const highConfidence = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
];
const literalSecret = /\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*["'`]((?!process\.env|import\.meta|your[_ -]|change[_ -]|replace[_ -]|example|placeholder|redacted|undefined|null)[^"'`\r\n]{8,})["'`]/i;
const ignoredGenerated = /^(?:public\/data\/|public\/.*\.(?:js|map|json)$)/i;
const findings = [];

const add = (kind, file, detail) => findings.push({ kind, file, detail });

for (const file of [...tracked, ...untracked]) {
  if (sensitiveName.test(file)) {
    const trackedFlag = tracked.includes(file) ? "tracked" : "untracked";
    add("sensitive filename", file, trackedFlag);
  }
}

for (const file of tracked) {
  if (ignoredGenerated.test(file)) continue;
  const absolute = path.join(root, file);
  let stat;
  try {
    stat = fs.statSync(absolute);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;
  const data = fs.readFileSync(absolute);
  if (data.includes(0)) continue;
  const text = data.toString("utf8");
  for (const pattern of highConfidence) {
    if (pattern.test(text)) add("high-confidence secret", file, pattern.source);
  }
  if (literalSecret.test(text)) add("literal secret assignment", file, "non-placeholder literal");
}

const publicFiles = list(["ls-tree", "-r", "--name-only", "origin/gh-pages", "-z"]);
for (const file of publicFiles) {
  if (sensitiveName.test(file) || /(^|\/)(server|\.github)(\/|$)|\.map$/i.test(file)) {
    add("public branch sensitive artifact", file, "origin/gh-pages");
  }
}
const publicText = (() => {
  try {
    return run(["grep", "-I", "-n", "-E", "JWT_SECRET|DATABASE_URL|BUILT_IN_FORGE_API_KEY|OPENAI_API_KEY|BEGIN [A-Z ]*PRIVATE KEY", "origin/gh-pages", "--"]);
  } catch {
    return "";
  }
})();
if (publicText.trim()) add("public branch secret configuration", "origin/gh-pages", "server secret name or private key marker");

console.log(`Security audit: tracked=${tracked.length}, untracked=${untracked.length}, findings=${findings.length}`);
if (findings.length) {
  for (const finding of findings) console.error(`${finding.kind}: ${finding.file} (${finding.detail})`);
  process.exitCode = 1;
} else {
  console.log("PASS: no high-confidence secrets, sensitive filenames, or server artifacts are tracked/public.");
}
