import js from '@eslint/js';
import globals from 'globals';
export default [
  {
    files: ['src/components/**/*.jsx', 'src/hooks/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, React: true },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' }
    },
    rules: { 'no-undef': 'error' }
  }
];
