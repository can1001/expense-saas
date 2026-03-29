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
    // PWA generated files
    "public/sw.js",
    "public/workbox-*.js",
    "public/worker-*.js",
    // Documentation
    "docs/**",
    // Coverage
    "coverage/**",
    // Scripts (development utilities)
    "scripts/**",
  ]),
  // Custom rules
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Allow require() in JavaScript scripts
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Disable React Hook rules in test fixtures
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Disable img element warnings for print and signature components
  // These components use <img> intentionally because Next.js Image doesn't work in print contexts
  {
    files: [
      "components/print/**/*.tsx",
      "components/*Printable*.tsx",
      "components/signature/**/*.tsx",
      "components/approval/ApprovalLineDisplay.tsx",
      "components/mobile/CameraCapture.tsx",
      "app/approvals/**/page.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
