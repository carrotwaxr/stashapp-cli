import pluginJs from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ["dist/**"],
    },
    pluginJs.configs.recommended,
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            globals: globals.node,
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        plugins: {
            import: importPlugin,
            "@typescript-eslint": tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            // Enforce sorted imports and autofix
            "import/order": [
                "error",
                { alphabetize: { order: "asc", caseInsensitive: true } },
            ],
            // Disable base rules that conflict with TS versions
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/ban-ts-comment": "warn",
            "no-empty": "warn",
            "no-control-regex": "warn",
            "no-case-declarations": "warn",
        },
    },
];
