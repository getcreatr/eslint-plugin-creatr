'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow exporting metadata or viewport from client components (components with "use client")',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/api-reference/directives/use-client'
    },
    messages: {
      noMetadataInClient: 'Cannot export "metadata" from a component marked with "use client". Remove the export or the "use client" directive.',
      noViewportInClient: 'Cannot export "viewport" from a component marked with "use client". Remove the export or the "use client" directive.'
    },
    schema: []
  },

  create(context) {
    let hasUseClientDirective = false;
    let metadataExportNode = null;
    let viewportExportNode = null;

    return {
      Program() {
        hasUseClientDirective = false;
        metadataExportNode = null;
        viewportExportNode = null;
      },

      ExpressionStatement(node) {
        // Check for "use client" directive
        if (
          node.expression.type === 'Literal' &&
          (node.expression.value === 'use client' ||
            node.expression.value === '"use client"' ||
            node.expression.value === '\'use client\'')
        ) {
          hasUseClientDirective = true;
        }
      },

      'Literal:first-child'(node) {
        // Check if the first statement is "use client"
        if (
          node.parent.type === 'ExpressionStatement' &&
          node.parent.parent.type === 'Program' &&
          node.parent.parent.body[0] === node.parent &&
          (node.value === 'use client' ||
            node.value === '"use client"' ||
            node.value === '\'use client\'')
        ) {
          hasUseClientDirective = true;
        }
      },

      ExportNamedDeclaration(node) {
        // Check direct exports (variable declarations)
        if (node.declaration && node.declaration.type === 'VariableDeclaration') {
          for (const declaration of node.declaration.declarations) {
            if (declaration.id.name === 'metadata') {
              metadataExportNode = node;
            } else if (declaration.id.name === 'viewport') {
              viewportExportNode = node;
            }
          }
        }

        // Check re-exports (exported specifiers)
        if (node.specifiers && node.specifiers.length > 0) {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === 'ExportSpecifier' &&
              specifier.exported.name === 'metadata'
            ) {
              metadataExportNode = node;
            } else if (
              specifier.type === 'ExportSpecifier' &&
              specifier.exported.name === 'viewport'
            ) {
              viewportExportNode = node;
            }
          }
        }
      },

      'Program:exit'() {
        // After parsing the entire file, check if we have client directive with restricted exports
        if (hasUseClientDirective) {
          if (metadataExportNode) {
            context.report({
              node: metadataExportNode,
              messageId: 'noMetadataInClient'
            });
          }

          if (viewportExportNode) {
            context.report({
              node: viewportExportNode,
              messageId: 'noViewportInClient'
            });
          }
        }
      }
    };
  }
};