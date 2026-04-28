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
    "coach-api-push/**",
    "PMUGAGNANT--main/**",
    "pull-backup-*/**",
    // Legacy/archived code paths kept for reference but not used by the app router build.
    "src/app.js",
    "src/core/**",
    "src/use-cases/**",
    "tests/**",
  ]),
]);

export default eslintConfig;
