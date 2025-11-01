// .eslintrc.mjs
import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import security from "eslint-plugin-security";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Configurações básicas do JavaScript
  js.configs.recommended,
  
  // Configurações do Next.js
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    plugins: {
      "@next/next": next,
    },
    rules: {
      ...next.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  
  // Configurações do TypeScript
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      parser: typescriptEslint.configs.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" }
      ],
    },
  },
  
  // Configurações de Segurança
  {
    plugins: {
      security,
    },
    rules: {
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-possible-timing-attacks": "error",
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "react/no-danger": "error",
    },
  },
  
  // Configurações globais e adicionais
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },
];