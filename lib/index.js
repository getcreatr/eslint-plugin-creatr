// lib/index.js
'use strict';

const requireIndex = require('requireindex');

// Import all rules in the rules directory
const rules = requireIndex(__dirname + '/rules');

// Import all configurations
requireIndex(__dirname + '/configs');

module.exports = {
  rules,
  configs: {
    recommended: require('./configs/recommended'),
    'nextjs-app-router': require('./configs/nextjs-app-router'),
  },
};