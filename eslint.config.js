import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['mocks/**', 'screenshots/**', 'dist/**', 'index.html'],
  },

  // Node-side code: the generator, the CLI and the integration layer.
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.nodeBuiltin,
    },
    plugins: { prettier },
    rules: {
      ...js.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      'prettier/prettier': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // the generator and the plugin log progress on purpose
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  // Code that runs inside the browser page Puppeteer drives.
  {
    files: ['src/browser/**/*.js'],
    languageOptions: { globals: globals.browser },
  },

  // The local preview harness (React, browser).
  {
    files: ['preview/**/*.jsx'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.nodeBuiltin, ...globals.vitest } },
  },
]
