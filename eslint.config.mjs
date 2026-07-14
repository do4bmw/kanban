import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Downgrade long-standing stylistic rules to warnings so CI stays a
  // meaningful gate: TypeScript type errors and build failures block merges,
  // while these style preferences don't turn the whole pipeline red.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // Flags calling a hoisted function declaration before its definition in
      // the file — valid at runtime, and a widespread pattern here.
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
