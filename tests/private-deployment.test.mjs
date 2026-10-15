import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rejectSymlinks, validatePrivateRelease } from "../scripts/prepare-private-deploy.mjs";

describe("FINETUNE private Safari deployment safety", () => {
  const clean = {
    sourceDirty: false,
    sourceCommit: "a".repeat(40),
    version: "1.29",
    channel: "production"
  };
  it("accepts only a clean, auditable production release", () => {
    expect(() => validatePrivateRelease(clean)).not.toThrow();
    for (const change of [{ sourceDirty: true }, { sourceCommit: "unknown" },
      { channel: "development" }, { version: "" }]) {
      expect(() => validatePrivateRelease({ ...clean, ...change })).toThrow();
    }
  });
  it("rejects symlink inputs instead of copying unexpected files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-private-"));
    try {
      const source = path.join(root, "source");
      fs.mkdirSync(source);
      fs.writeFileSync(path.join(source, "index.html"), "test");
      expect(() => rejectSymlinks(source)).not.toThrow();
      const alias = path.join(root, "alias");
      try { fs.symlinkSync(source, alias, process.platform === "win32" ? "junction" : "dir"); }
      catch { return; }
      expect(() => rejectSymlinks(alias)).toThrow();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
