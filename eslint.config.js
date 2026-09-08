const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const eslintConfigPrettier = require('eslint-config-prettier')

module.exports = [
  {
    ignores: ['**/dist', '**/coverage', '**/reports', 'node_modules', 'src/app/shared/generated'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  eslintConfigPrettier,
]
