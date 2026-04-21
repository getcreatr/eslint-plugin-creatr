// lib/rules/require-use-client.js
'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require "use client" directive when using client-side libraries or hooks',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/yourusername/eslint-plugin-creatr/blob/main/docs/rules/require-use-client.md',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          libraries: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          hooks: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          checkEventHandlers: {
            type: 'boolean',
            default: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingUseClient: 'This file uses client-side features ({{ reason }}) and requires the "use client" directive.',
    },
  },
  create(context) {
    const options = context.options[0] || {};

    // Default client-side libraries
    const defaultLibraries = [
      'framer-motion',
      'react-spring',
      'react-use',
      'react-intersection-observer',
      'react-hook-form',
      '@tanstack/react-query',
      'swr',
      'react-hot-toast',
      'react-beautiful-dnd',
      '@dnd-kit/core',
      'react-dnd',
      'recharts',
      'react-chartjs-2',
      'lottie-react',
      'react-player',
      '@react-three/fiber',
      '@react-three/drei',
      'motion/react'
    ];

    // Default client-side hooks
    const defaultHooks = [
      'useState',
      'useEffect',
      'useLayoutEffect',
      'useRef',
      'useCallback',
      'useMemo',
      'useReducer',
      'useContext',
      'useImperativeHandle',
      'useDebugValue',
      'useDeferredValue',
      'useTransition',
      'useId',
      'useSyncExternalStore',
      'useInsertionEffect',
    ];

    const clientLibraries = [...defaultLibraries, ...(options.libraries || [])];
    const clientHooks = [...defaultHooks, ...(options.hooks || [])];
    const checkEventHandlers = options.checkEventHandlers !== false;

    let hasUseClientDirective = false;
    let violations = [];

    return {
      Program(node) {
        hasUseClientDirective = false;
        violations = [];

        // Check if file has "use client" at the beginning
        if (node.body.length > 0) {
          const firstStatement = node.body[0];
          if (
            firstStatement.type === 'ExpressionStatement' &&
            firstStatement.expression.type === 'Literal' &&
            (firstStatement.expression.value === 'use client' ||
              firstStatement.expression.value === 'use client;')
          ) {
            hasUseClientDirective = true;
          }
        }
      },

      // Check imports
      ImportDeclaration(node) {
        const importedLibrary = node.source.value;

        // Check if this is a client-side library
        if (clientLibraries.some(lib => importedLibrary.startsWith(lib))) {
          violations.push({
            node,
            reason: `imports "${importedLibrary}"`,
          });
        }
      },

      // Check for React hooks usage
      CallExpression(node) {
        if (node.callee.type === 'Identifier') {
          const functionName = node.callee.name;

          if (clientHooks.includes(functionName)) {
            violations.push({
              node,
              reason: `uses React hook "${functionName}"`,
            });
          }
        }
      },

      // Check for event handlers (onClick, onChange, etc.)
      //
      // We only flag event handlers on *intrinsic* DOM elements (lowercase JSX
      // names like <button>, <input>, <div>). Custom components (<MyComponent>,
      // <motion.div>) use `on*` for arbitrary prop names — "onSignOut",
      // "onValueChange", etc. — and don't imply a DOM event binding.
      // Separately, if a library import already marks this as a client-only
      // file, that import will be reported first.
      JSXAttribute(node) {
        if (!checkEventHandlers) return;

        if (node.name.type !== 'JSXIdentifier') return;
        const attrName = node.name.name;
        if (!attrName.startsWith('on') || !/^on[A-Z]/.test(attrName)) return;

        // Only intrinsic DOM elements have real event handlers.
        const opening = node.parent;
        const isIntrinsic =
          opening &&
          opening.type === 'JSXOpeningElement' &&
          opening.name &&
          opening.name.type === 'JSXIdentifier' &&
          /^[a-z]/.test(opening.name.name);
        if (!isIntrinsic) return;

        // Ignore serializable non-function values (undefined, null, booleans,
        // numbers, strings) — these are not actual event handlers.
        if (node.value && node.value.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;
          if (expr.type === 'Identifier' && expr.name === 'undefined') return;
          if (
            expr.type === 'Literal' &&
            (expr.value === null ||
              typeof expr.value === 'boolean' ||
              typeof expr.value === 'number' ||
              typeof expr.value === 'string')
          ) return;
        }

        violations.push({
          node,
          reason: `uses event handler "${attrName}"`,
        });
      },

      'Program:exit'(node) {
        if (violations.length > 0 && !hasUseClientDirective) {
          // Report only the first violation to avoid too many errors
          const firstViolation = violations[0];

          context.report({
            node: firstViolation.node,
            messageId: 'missingUseClient',
            data: { reason: firstViolation.reason },
            fix(fixer) {
              // If there are any nodes, insert before the first one
              if (node.body.length > 0) {
                const firstNode = node.body[0];
                return fixer.insertTextBefore(firstNode, '"use client";\n\n');
              }

              // Empty file, just add at the beginning
              return fixer.insertTextAfterRange([0, 0], '"use client";\n\n');
            },
          });
        }
      },
    };
  },
};