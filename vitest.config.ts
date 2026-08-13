import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws on import outside a Server Component, which is the
      // point of it in production but makes server modules untestable. Stubbing
      // it here keeps the runtime guard while letting the tests run.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: [
        "src/lib/{client-api,client-download,csv,job-dates,job-transitions,logger,owners,permissions,portal-access,time-clock,utils,validation}.ts",
        "src/lib/operations/route-domains.ts",
        "src/lib/supabase/mappers.ts",
        "src/components/ui/{Modal,Button,Field}.tsx",
        "src/components/navigation/PortalSwitch.tsx",
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
