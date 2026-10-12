import { expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readSourceState } from "../scripts/lib/source-state.mjs";

it("detects clean, untracked, staged and generated modifications without changing git state", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-source-state-"));
  const git = args => { const r = spawnSync("git", args, { cwd, encoding: "utf8" }); expect(r.status).toBe(0); return r.stdout.trim(); };
  try {
    git(["init", "--quiet"]);
    fs.writeFileSync(path.join(cwd, "input.json"), "{}");
    git(["add", "input.json"]);
    git(["-c", "user.name=QA", "-c", "user.email=qa@example.invalid", "commit", "--quiet", "-m", "fixture"]);
    const original = readSourceState(cwd); expect(original.sourceDirty).toBe(false);
    fs.writeFileSync(path.join(cwd, "new.json"), "{}");
    expect(readSourceState(cwd)).toEqual({ ...original, sourceDirty: true });
    git(["add", "new.json"]); expect(readSourceState(cwd).sourceDirty).toBe(true);
    git(["-c", "user.name=QA", "-c", "user.email=qa@example.invalid", "commit", "--quiet", "-m", "fixture2"]);
    expect(readSourceState(cwd).sourceDirty).toBe(false);
    fs.writeFileSync(path.join(cwd, "input.json"), '{"generated":true}');
    const before = git(["status", "--porcelain"]);
    expect(readSourceState(cwd).sourceDirty).toBe(true);
    expect(git(["status", "--porcelain"])).toBe(before);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
