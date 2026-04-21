'use strict';

module.exports = {
  plugins: ['creatr'],
  rules: {
    'creatr/require-use-client': 'error',
    'creatr/no-browser-globals-in-ssr': 'error',
    'creatr/no-metadata-in-client-components': 'error',
    'creatr/no-event-handlers-in-server-components': 'error',
    'creatr/no-parallel-page-routes': 'error',
  },
};