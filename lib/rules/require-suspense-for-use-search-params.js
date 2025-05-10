// lib/rules/require-suspense-for-use-search-params.js
'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require useSearchParams() to be wrapped in a Suspense boundary in Next.js 15 App Router',
      category: 'Next.js App Router',
      recommended: true,
      url: 'https://github.com/yourusername/eslint-plugin-creatr/blob/main/docs/rules/require-suspense-for-use-search-params.md',
    },
    messages: {
      missingSuspenseBoundary: 'useSearchParams() must be wrapped in a Suspense boundary. Wrap the component using useSearchParams() in <Suspense> or move it to a separate Client Component wrapped in Suspense.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignoreFiles: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const ignoreFiles = options.ignoreFiles || [];

    // Check if current file should be ignored
    const filename = context.getFilename();
    if (ignoreFiles.some(pattern => filename.includes(pattern))) {
      return {};
    }

    let hasUseSearchParamsImport = false;
    const functionInfo = new Map(); // Track function info
    const defaultExports = new Set(); // Track what's default exported

    function isSuspenseElement(node) {
      if (!node || node.type !== 'JSXElement') return false;

      const name = node.openingElement.name;
      return (
        (name.type === 'JSXIdentifier' && name.name === 'Suspense') ||
				(name.type === 'JSXMemberExpression' &&
					name.object.name === 'React' &&
					name.property.name === 'Suspense')
      );
    }

    function findContainingFunction(node) {
      let current = node;
      while (current) {
        if (current.type === 'FunctionDeclaration' ||
					current.type === 'FunctionExpression' ||
					current.type === 'ArrowFunctionExpression') {
          return current;
        }
        current = current.parent;
      }
      return null;
    }

    function getComponentName(funcNode) {
      if (funcNode.type === 'FunctionDeclaration' && funcNode.id) {
        return funcNode.id.name;
      }

      // For arrow functions and function expressions, check the parent
      const parent = funcNode.parent;
      if (parent && parent.type === 'VariableDeclarator' && parent.id) {
        return parent.id.name;
      }

      return null;
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'next/navigation') {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier' &&
							specifier.imported.name === 'useSearchParams') {
              hasUseSearchParamsImport = true;
            }
          }
        }
      },

      // Initialize function tracking
      ':function'(node) {
        functionInfo.set(node, {
          usesSearchParams: false,
          useSearchParamsNodes: [],
          returnsSuspense: false,
          allReturns: [],
        });
      },

      // Track default exports
      ExportDefaultDeclaration(node) {
        if (node.declaration.type === 'Identifier') {
          defaultExports.add(node.declaration.name);
        } else if (node.declaration.type === 'FunctionDeclaration' ||
					node.declaration.type === 'FunctionExpression' ||
					node.declaration.type === 'ArrowFunctionExpression') {
          defaultExports.add(node.declaration);
        }
      },

      // Track useSearchParams calls
      CallExpression(node) {
        if (!hasUseSearchParamsImport) return;

        if (node.callee.type === 'Identifier' &&
					node.callee.name === 'useSearchParams') {
          const containingFunc = findContainingFunction(node);
          if (containingFunc) {
            const info = functionInfo.get(containingFunc);
            if (info) {
              info.usesSearchParams = true;
              info.useSearchParamsNodes.push(node);
            }
          }
        }
      },

      // Track all returns
      ReturnStatement(node) {
        const containingFunc = findContainingFunction(node);
        if (containingFunc) {
          const info = functionInfo.get(containingFunc);
          if (info && node.argument) {
            info.allReturns.push(node.argument);

            // Check if this return has Suspense
            if (isSuspenseElement(node.argument)) {
              info.returnsSuspense = true;
            }

            // Check for fragment with Suspense as first child
            if (node.argument.type === 'JSXFragment') {
              const children = node.argument.children.filter(child =>
                !(child.type === 'JSXText' && child.value.trim() === '')
              );
              if (children.length > 0 && isSuspenseElement(children[0])) {
                info.returnsSuspense = true;
              }
            }
          }
        }
      },

      // Handle arrow functions with implicit returns
      ':function:exit'(node) {
        const info = functionInfo.get(node);
        if (!info) return;

        // For arrow functions with implicit return
        if (node.type === 'ArrowFunctionExpression' &&
					node.body.type !== 'BlockStatement') {
          info.allReturns.push(node.body);

          if (isSuspenseElement(node.body)) {
            info.returnsSuspense = true;
          }

          // Check for fragment with Suspense as first child
          if (node.body.type === 'JSXFragment') {
            const children = node.body.children.filter(child =>
              !(child.type === 'JSXText' && child.value.trim() === '')
            );
            if (children.length > 0 && isSuspenseElement(children[0])) {
              info.returnsSuspense = true;
            }
          }
        }

        // Check if this function is default exported
        let isDefaultExported = false;

        // Direct default export
        if (defaultExports.has(node)) {
          isDefaultExported = true;
        }

        // Exported by name
        const componentName = getComponentName(node);
        if (componentName && defaultExports.has(componentName)) {
          isDefaultExported = true;
        }

        // Report error if needed
        if (isDefaultExported && info.usesSearchParams && !info.returnsSuspense) {
          for (const searchParamsNode of info.useSearchParamsNodes) {
            context.report({
              node: searchParamsNode,
              messageId: 'missingSuspenseBoundary',
            });
          }
        }
      },
    };
  },
};