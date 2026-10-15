import { build } from "esbuild";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// QA only: never copy this directory into a production export.
const root = process.cwd();
const output = resolve(root, "output/learning-storage-qa");
await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error("QA output must be empty; preserve prior evidence and choose a fresh run.");
await build({ entryPoints: [resolve(root, "tests/browser/learning-storage-harness.ts")], outfile: resolve(output, "harness.js"),
  bundle: true, platform: "browser", format: "esm", target: "es2022", sourcemap: false, logLevel: "info" });
await writeFile(resolve(output, "index.html"), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FINETUNE isolated storage QA</title><style>body{font:16px system-ui;margin:24px;max-width:1000px}button,a{display:inline-block;margin:8px;padding:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:16px}h1{font-size:24px}</style>
<h1>FINETUNE isolated storage QA</h1><p>localhost only · real IndexedDB · synthetic records only · no production database access</p>
<button id="suite">Run deterministic suite</button><button id="reload">Start 20 reloads</button><button id="staged">Stage interrupted write and reload</button>
<button id="race">Start cross-tab race</button><button id="join">Join cross-tab race</button><a id="peer" target="_blank" rel="noopener">Open isolated peer tab</a>
<pre id="result" role="status">Starting…</pre><script type="module" src="./harness.js"></script></html>`, "utf8");
console.log(JSON.stringify({ status: "READY", output: "output/learning-storage-qa", run: "Serve this directory on 127.0.0.1, then open index.html. No tests have run." }));
