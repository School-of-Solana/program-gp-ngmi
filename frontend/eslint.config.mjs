// eslint.config.mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Ignore throwaway “copy” files so hooks rules stop tripping on dead code.
  {
    ignores: ['**/* copy.ts*', '**/* copy *.tsx'],
  },

  // Codama auto-generated instructions use `{}` for empty args; silence that rule here.
  {
    files: ['src/lib/codama/instructions/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];

export default eslintConfig;