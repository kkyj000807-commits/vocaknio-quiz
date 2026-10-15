import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const publicRoot = path.join(root, "output", "finetune-private-deploy", "vocaknio-quiz");

export function accessDeniedForAnonymous(status, location = "") {
  if (status === 401 || status === 403) return true;
  if (![301, 302, 303, 307, 308].includes(status)) return false;
  return /(?:^|\.)cloudflareaccess\.com(?:[/:?#]|$)|\/cdn-cgi\/access\/(?:login|authorize)(?:[/?#]|$)/i.test(location);
}

export function expectedProtectedPaths(assetsDir = publicRoot) {
  const index = fs.readFileSync(path.join(assetsDir, "index.html"), "utf8");
  const release = JSON.parse(fs.readFileSync(path.join(assetsDir, "release.json"), "utf8"));
  const script = index.match(/src=["'](\/vocaknio-quiz\/[^"'\s]+\.js)["']/)?.[1];
  const dictionaries = path.join(assetsDir, "data", "vocab-definitions", "oewn-2025");
  const learning = path.join(assetsDir, "data", "vocab-learning", release.learningDataVersion);
  const sampleJson = dir => fs.readdirSync(dir).find(name => name.endsWith(".json"));
  const dictionary = sampleJson(dictionaries);
  const learned = sampleJson(learning);
  if (!script || !dictionary || !learned) throw new Error("Production manifest does not contain expected protected assets.");
  return [
    "/vocaknio-quiz/",
    "/vocaknio-quiz/index.html",
    "/vocaknio-quiz/release.json",
    script,
    "/vocaknio-quiz/data/vocab-definitions/oewn-2025/" + dictionary,
    "/vocaknio-quiz/data/vocab-learning/" + release.learningDataVersion + "/" + learned,
    "/vocaknio-quiz/quiz.html"
  ];
}

export async function verifyAccess(baseUrl, paths = expectedProtectedPaths(), fetcher = fetch) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || !base.hostname.endsWith(".workers.dev") || !base.hostname.startsWith("finetune-private.")) {
    throw new Error("Pass the exact private FINETUNE workers.dev HTTPS origin.");
  }
  const checks = [];
  for (const route of paths) {
    const target = new URL(route, base.origin);
    const response = await fetcher(target, { redirect: "manual", cache: "no-store" });
    const redirect = response.headers.get("location") ?? "";
    const denied = accessDeniedForAnonymous(response.status, redirect);
    checks.push({ route, status: response.status, denied, redirectToAccess: denied && Boolean(redirect) });
  }
  return { status: checks.every(check => check.denied) ? "PASS_ANONYMOUS_BLOCKED" : "FAIL_PUBLICLY_ACCESSIBLE_OR_UNVERIFIED", checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const origin = process.argv[2];
  if (!origin) { console.error("Usage: node scripts/verify-private-access.mjs https://finetune-private.<account>.workers.dev"); process.exit(1); }
  try {
    const result = await verifyAccess(origin);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "PASS_ANONYMOUS_BLOCKED") process.exitCode = 1;
  } catch (error) {
    console.error("Private Access check failed: " + error.message);
    process.exitCode = 1;
  }
}
