import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/setup/**/*.test.ts", "tests/server/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    env: { MONEY_DEFAULT_POSTING_FEE: "0" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
