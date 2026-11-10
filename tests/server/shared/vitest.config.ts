import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname, "../../..");

/**
 * The root vitest.config.ts include is owned by T0.3 and only matches tests/setup.
 * This file is a T1.1 path. Run: npx vitest run --config tests/server/shared/vitest.config.ts
 */
export default defineConfig({
  root,
  test: {
    include: ["tests/server/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
