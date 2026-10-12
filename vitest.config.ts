import { defineConfig } from "vitest/config";
import path from "path";
import { createRequire } from "node:module";
const resource: typeof import("./scripts/lib/resource-budget.cjs") = createRequire(import.meta.url)("./scripts/lib/resource-budget.cjs");

const resourcePlan = resource.chooseResourceBudget(resource.readMemorySnapshotSync());
// Vitest applies env pool overrides after config. Clamp all four before resolve.
Object.assign(process.env, resource.workerEnvironment(resourcePlan));

export default defineConfig({
  test: {
    dir: "./tests",
    environment: "node",
    globals: true,
    maxWorkers: resourcePlan.workers,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  plugins: [],
});
