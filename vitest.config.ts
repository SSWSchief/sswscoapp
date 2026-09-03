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
    // The component tests render under jsdom with coverage instrumentation.
    // They finish in well under a second each when the machine is idle, but the
    // 5s default is close enough to trip spuriously when the suite runs in
    // parallel on a loaded CI runner. A failing build should mean broken code.
    testTimeout: 20000,
    coverage: {
      reporter: ["text", "html"],
      include: [
        "src/lib/{client-api,client-download,csv,email-delivery,employee-conflict,job-dates,job-transitions,logger,owners,password-policy,permissions,portal-access,time-clock,utils,validation}.ts",
        "src/lib/operations/route-domains.ts",
        "src/lib/supabase/mappers.ts",
        // The billing modules are gated here deliberately. They decide what
        // gets charged to a customer and what the office is told when that
        // fails, and they were the least covered code in the repository at the
        // point Stripe went in.
        "src/lib/stripe/*.ts",
        "src/lib/invoices/*.ts",
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
