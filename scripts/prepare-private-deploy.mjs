import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = path.join(root, "output", "finetune-private-deploy");

export function validatePrivateRelease(release) {
  if (!release || release.sourceDirty !== false ||
      !/^[a-f0-9]{40}$/.test(String(release.sourceCommit ?? "")) ||
      !release.version || release.channel !== "production") {
    throw new Error("Private deploy requires a clean, verified Production release with source SHA.");
  }
}

export function rejectSymlinks(directory) {
  if (fs.lstatSync(directory).isSymbolicLink()) {
    throw new Error("Refusing symlink in private deploy input: " + directory);
  }
  if (fs.statSync(directory).isDirectory()) {
    for (const entry of fs.readdirSync(directory)) rejectSymlinks(path.join(directory, entry));
  }
}

export function preparePrivateDeploy(sourceDirectory) {
  const source = path.resolve(sourceDirectory);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error("Provide an existing, verified Production export directory.");
  }
  if (source === target || source.startsWith(target + path.sep)) {
    throw new Error("Private deployment output cannot be used as its own source.");
  }
  rejectSymlinks(source);
  const audit = spawnSync(process.execPath, [path.join(root, "scripts", "audit-production-output.mjs"), source], {
    cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024
  });
  if (audit.status !== 0) {
    throw new Error("Production audit failed; deployment blocked. " + (audit.stderr || audit.stdout || "").slice(-2500));
  }
  const release = JSON.parse(fs.readFileSync(path.join(source, "release.json"), "utf8"));
  validatePrivateRelease(release);
  const outputParent = path.dirname(target);
  if (fs.existsSync(outputParent) && fs.lstatSync(outputParent).isSymbolicLink()) {
    throw new Error("Refusing symlink output parent.");
  }
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isDirectory() || fs.readdirSync(target).length > 0) {
      throw new Error("Private output is not empty; preserve it and choose a clean workspace.");
    }
  }
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, path.join(target, "vocaknio-quiz"), { recursive: true, force: false, errorOnExist: true });
  const nested = path.join(target, "vocaknio-quiz");
  for (const relative of ["index.html", "release.json", ".nojekyll"]) {
    if (!fs.existsSync(path.join(nested, relative))) {
      throw new Error("Private asset missing: " + relative);
    }
  }
  console.log(JSON.stringify({
    status: "PREPARED_NOT_DEPLOYED",
    assetsDirectory: target,
    safariPath: "/vocaknio-quiz/",
    sourceCommit: release.sourceCommit,
    version: release.version,
    accessRequired: "Cloudflare Worker-level Access: all traffic, exact owner identity",
    workersDevRouteEnabled: false
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) {
    console.error("Usage: node scripts/prepare-private-deploy.mjs <verified-production-export>");
    process.exit(1);
  }
  try { preparePrivateDeploy(process.argv[2]); }
  catch (error) { console.error(error.message); process.exit(1); }
}
