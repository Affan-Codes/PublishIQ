import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../database/db.js',
              message: 'Database connection client can only be imported from repository layer files.',
            },
            {
              name: '../../database/db.js',
              message: 'Database connection client can only be imported from repository layer files.',
            },
            {
              name: '../../../database/db.js',
              message: 'Database connection client can only be imported from repository layer files.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/repositories/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
