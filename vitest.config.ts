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
        "src/lib/{client-api,client-download,csv,job-dates,job-transitions,logger,owners,permissions,time-clock,utils,validation}.ts",
        "src/lib/operations/route-domains.ts",
        "src/lib/supabase/mappers.ts",
        "src/components/ui/{Modal,Button,Field}.tsx",
        "src/components/dispatcher/TrainingDataPanel.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
