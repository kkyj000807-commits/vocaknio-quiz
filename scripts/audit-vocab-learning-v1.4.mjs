import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/build-vocab-learning-v1.4.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
