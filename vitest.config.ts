import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/setup/**/*.test.ts", "tests/server/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
