import { spawnSync } from "node:child_process";

/** Includes staged, unstaged and untracked paths. No source or secrets in logs. */
export function readSourceState(cwd = process.cwd()) {
  const run = args => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
    if (result.status !== 0) throw new Error("Cannot identify source working state");
    return result.stdout.trim();
  };
  const sourceCommit = run(["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("Cannot identify source commit");
  const status = run(["status", "--porcelain=v1", "--untracked-files=normal"]);
  return { sourceCommit, sourceDirty: status.length > 0 };
}
