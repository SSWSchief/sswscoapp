// Stands in for the `server-only` package under Vitest. The real module throws
// on import so server code can never be bundled into the browser; that guard is
// still active in the application build and is only bypassed for tests.
export {};
