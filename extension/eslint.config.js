module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', '*.min.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',

        // Chrome extension globals
        chrome: 'readonly'
      }
    },
    rules: {
      'indent': ['error', 2],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // Console is used for debugging
      'comma-dangle': ['error', 'only-multiline'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'keyword-spacing': 'error',
      'space-before-blocks': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': 'error',
      'space-infix-ops': 'error',
      'key-spacing': 'error',
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0 }],
      'no-trailing-spaces': 'error',
      'no-undef': 'error',
      'no-redeclare': 'error'
    }
  }
];