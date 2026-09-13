import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

// eslint-config-next@16 ships core-web-vitals as a native flat-config array
// (import it directly) — only "prettier" (still a legacy shareable config)
// needs FlatCompat. Mixing the flat-native plugin objects through
// FlatCompat's legacy resolver corrupts them (circular-reference crash).
export default defineConfig([
    { ignores: [".next/**", "node_modules/**"] },
    {
        extends: [...nextCoreWebVitals, ...compat.extends("prettier")],
    },
]);