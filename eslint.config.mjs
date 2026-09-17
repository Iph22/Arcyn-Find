// PARKED — not the active linter. `npm run lint` runs oxlint (.oxlintrc.json).
//
// This config cannot execute against this project: it extends
// eslint-config-next, which pulls in typescript-eslint, which refuses to load
// on TypeScript 7 ("typescript-eslint does not support TS 7.0"). The parser
// package is blocked too, so there is no partial-config escape hatch.
// Tracking: https://github.com/typescript-eslint/typescript-eslint/issues/10940
//
// Kept so the ESLint setup can be restored in one step once upstream supports
// TS >= 7.1; its dependencies are intentionally NOT installed until then, so
// that `npm run lint` cannot silently resolve to a broken command again.

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
