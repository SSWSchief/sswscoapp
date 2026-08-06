import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "**/* 2.ts", "**/* 2.tsx", "**/* 3.tsx"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
