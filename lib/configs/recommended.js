'use strict';

module.exports = {
  plugins: ['creatr'],
  rules: {
    'creatr/require-use-client': 'error',
    'creatr/no-browser-globals-in-ssr': 'error',
    'creatr/no-metadata-in-client-components': 'error',
    'creatr/no-event-handlers-in-server-components': 'error',
    'creatr/no-parallel-page-routes': 'error',
    'creatr/no-server-components-in-client': 'error',
    'creatr/no-pages-router-imports-in-app': 'error',
    'creatr/no-hardcoded-redirect-urls': 'error',
    'creatr/no-router-in-server-components': 'error',
    'creatr/require-server-action-metadata': 'error',
    'creatr/no-invalid-next-routes': ['error', { appDir: 'src/app' }],
    'creatr/require-component-prop': ['error', {
      components: [
        { name: 'SelectItem', prop: 'value' },
        { name: 'Select.Item', prop: 'value' },
        { name: 'TabsTrigger', prop: 'value' },
        { name: 'RadioGroupItem', prop: 'value' },
        { name: 'AccordionItem', prop: 'value' },
      ],
    }],
  },
};