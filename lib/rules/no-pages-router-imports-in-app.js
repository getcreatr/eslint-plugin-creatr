'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow 'next/router' (Pages Router) imports inside the App Router (app/ directory)",
      category: 'Next.js',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      useNavigationInstead: "'next/router' is the Pages Router API and cannot be used in the App Router (app/ directory). Use 'next/navigation' instead.",
    },
  },
  create(context) {
    const filename =
      (typeof context.filename === 'string' && context.filename) ||
      (typeof context.getFilename === 'function' && context.getFilename()) ||
      '';

    const isInAppDir = filename.replace(/\\/g, '/').includes('/app/');

    if (!isInAppDir) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'next/router') {
          context.report({
            node,
            messageId: 'useNavigationInstead',
          });
        }
      },
      // Catch re-exports: export { useRouter } from 'next/router'
      ExportNamedDeclaration(node) {
        if (node.source && node.source.value === 'next/router') {
          context.report({
            node,
            messageId: 'useNavigationInstead',
          });
        }
      },
    };
  },
};
