import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import { threadId } from 'node:worker_threads';
const directory = process.env.FINETUNE_RESOURCE_METRICS_DIR;
if (directory) {
  const file = path.join(directory, `${process.pid}-${threadId}.json`);
  const save = phase => {
    try {
      const memory = process.memoryUsage();
      fs.writeFileSync(file, JSON.stringify({ phase, pid: process.pid, parentPid: process.ppid, threadId, measuredAt: new Date().toISOString(), maxRssKiB: process.resourceUsage().maxRSS, finalRssBytes: memory.rss, finalHeapUsedBytes: memory.heapUsed, heapLimitBytes: v8.getHeapStatistics().heap_size_limit }));
    } catch { /* Metrics failure never replaces the workload's actual exit code. */ }
  };
  save('started');
  process.once('exit', () => save('exit'));
}
