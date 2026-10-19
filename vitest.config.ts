import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.spec.ts"],
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
    globals: false,
    reporters: "default",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
