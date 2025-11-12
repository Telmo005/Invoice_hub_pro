// eslint.config.mjs
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react': reactPlugin, '@typescript-eslint': tsPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    ...js.configs.recommended,
    rules: {
      // Next.js core web vitals equivalent rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript-specific no-unused-vars: disable base rule and use
      // the @typescript-eslint version which understands TS syntax.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        "vars": "all",
        "args": "after-used",
        "ignoreRestSiblings": true,
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],

      '@next/next/no-html-link-for-pages': 'off', // Desabilitado sem o plugin

      // Suas regras personalizadas
      'prefer-const': 'error',
    },
  },
];