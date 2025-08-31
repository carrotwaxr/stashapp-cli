import pluginJs from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    {
        plugins: {
            import: importPlugin,
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
