import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { productionSecurityIssues } from "../scripts/lib/production-security.mjs";

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true }); });
function fixture() { const folder = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-security-")); folders.push(folder); return folder; }
it("blocks secrets, environment files, server code and source maps without printing values", () => {
  const folder = fixture();
  const sentinel = "ghp_" + "Q".repeat(36);
  fs.writeFileSync(path.join(folder, "entry.js"), sentinel);
  fs.writeFileSync(path.join(folder, ".env"), "private fixture");
  fs.mkdirSync(path.join(folder, "server"));
  fs.writeFileSync(path.join(folder, "server", "index.js"), "export {}");
  fs.writeFileSync(path.join(folder, "entry.js.map"), "{}");
  const findings = productionSecurityIssues(folder);
  expect(findings.map(row => row.kind)).toEqual(expect.arrayContaining(["secret pattern", "private artifact"]));
  expect(findings.some(row => row.file === "server/index.js")).toBe(true);
  expect(JSON.stringify(findings)).not.toContain(sentinel);
});
it("allows only normal public learning artifacts in the clean fixture", () => {
  const folder = fixture();
  fs.writeFileSync(path.join(folder, "index.html"), "<title>FINETUNE</title>");
  fs.writeFileSync(path.join(folder, "learning.json"), '{"definition":"public learning content"}');
  expect(productionSecurityIssues(folder)).toEqual([]);
});
