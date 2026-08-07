import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: [
        "src/lib/csv.ts",
        "src/lib/job-dates.ts",
        "src/lib/job-transitions.ts",
        "src/lib/permissions.ts",
        "src/lib/time-clock.ts",
        "src/lib/validation.ts",
        "src/lib/operations/route-domains.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
