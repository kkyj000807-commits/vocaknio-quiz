import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/vocab-v1.4.test.ts",
      "tests/vocab-migration-v1.4.test.ts",
      "tests/vocab-storage-migration-v1.4.test.ts",
    ],
    exclude: [
      "node_modules/**",
      "tmp/**",
      "output/**",
      "analysis/**",
      "dist/**",
    ],
  },
});
