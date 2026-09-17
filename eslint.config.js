// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Handgeschriebenes, ungebündeltes Browser-Skript außerhalb der TS-Toolchain.
      '**/public/sw.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      complexity: ['error', 10],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Plain-JS-Konfigurationsdateien laufen außerhalb der Projekt-tsconfigs
    // und sollen nicht typgeprüft werden.
    files: ['**/*.config.js', '**/*.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Testdateien: mehrere `it()`-Blöcke unter einem `describe()` sprengen die
    // 40-Zeilen-Regel unvermeidlich — die Regel zielt auf Anwendungscode.
    files: ['**/test/**/*.spec.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
);
