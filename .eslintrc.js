// .eslintrc.js
module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', { 'args': 'none' }],
    'no-mixed-spaces-and-tabs': ['off']
  },
  overrides: [
    {
      files: ['tests/**/*.js', 'tests/**/*.test.js'],
      env: {
        mocha: true,
      },
    },
  ],
};