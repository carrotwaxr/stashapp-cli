import pluginJs from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: {
            import: importPlugin,
            "@typescript-eslint": tseslint,
        },
        languageOptions: {
            parser: tsParser,
        },
        rules: {
            // Enforce sorted imports and autofix
            "import/order": [
                "error",
                { alphabetize: { order: "asc", caseInsensitive: true } },
            ],
        },
    },
];
