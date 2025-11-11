// eslint.config.mjs
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const gitignorePath = resolve(__dirname, '.gitignore');

export default [
  includeIgnoreFile(gitignorePath),
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    ...js.configs.recommended,
    rules: {
      // Next.js core web vitals equivalent rules
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      '@next/next/no-html-link-for-pages': 'off', // Desabilitado sem o plugin
      
      // Suas regras personalizadas
      'no-unused-vars': 'warn',
      'prefer-const': 'error',
    },
  },
];