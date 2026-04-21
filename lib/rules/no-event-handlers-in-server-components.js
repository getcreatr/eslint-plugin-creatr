'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow event handlers in server components (components without "use client")',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/building-your-application/rendering/client-components#using-client-components-in-nextjs'
    },
    messages: {
      noEventHandlerInServer: 'Event handler "{{eventHandler}}" cannot be used in a server component. Add "use client" directive or move the interactive element to a client component.',
      noInlineEventHandler: 'Inline event handler "{{eventHandler}}" cannot be used in a server component. Add "use client" directive or move the interactive element to a client component.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedEventHandlers: {
            type: 'array',
            items: { type: 'string' },
            default: []
          },
          checkCustomComponents: {
            type: 'boolean',
            default: true
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedEventHandlers = options.allowedEventHandlers || [];
    const checkCustomComponents = options.checkCustomComponents !== false;

    let hasUseClientDirective = false;
    const eventHandlerPattern = /^on[A-Z]/;

    function checkForUseClientDirective(node) {
      // Check if this is the first node in the program
      if (node.parent.type === 'Program' && node.parent.body[0] === node) {
        if (node.type === 'ExpressionStatement') {
          // Handle regular string literals
          if (node.expression.type === 'Literal' &&
						typeof node.expression.value === 'string' &&
						node.expression.value === 'use client') {
            hasUseClientDirective = true;
          }
          // Handle template literals (backticks)
          else if (node.expression.type === 'TemplateLiteral' &&
						node.expression.quasis.length === 1 &&
						node.expression.quasis[0].value.raw === 'use client') {
            hasUseClientDirective = true;
          }
        }
      }
    }

    return {
      Program() {
        hasUseClientDirective = false;
      },

      // Handle different ways of expressing "use client"
      ExpressionStatement(node) {
        checkForUseClientDirective(node);
      },

      JSXAttribute(node) {
        // Skip if this component has "use client"
        if (hasUseClientDirective) return;

        const attributeName = node.name.name;

        // Check if it's an event handler prop
        if (eventHandlerPattern.test(attributeName)) {
          // Skip if it's in the allowed list
          if (allowedEventHandlers.includes(attributeName)) return;

          // Check if we're on a custom component (starts with uppercase)
          const isCustomComponent =
						node.parent &&
						node.parent.type === 'JSXOpeningElement' &&
						node.parent.name &&
						node.parent.name.type === 'JSXIdentifier' &&
						/^[A-Z]/.test(node.parent.name.name);

          // Skip checking custom components if configured
          if (!checkCustomComponents && isCustomComponent) {
            return;
          }

          // Check if the value is a function or function reference
          if (node.value && node.value.type === 'JSXExpressionContainer') {
            const expression = node.value.expression;

            // Ignore non-function literals: `undefined`, `null`, booleans,
            // numbers. These are serializable and safe to pass from a server
            // component to a client component via a custom-component prop.
            if (expression.type === 'Identifier' && expression.name === 'undefined') {
              return;
            }
            if (
              expression.type === 'Literal' &&
              (expression.value === null ||
                typeof expression.value === 'boolean' ||
                typeof expression.value === 'number')
            ) {
              return;
            }

            // Check for various function patterns
            const isFunction =
							expression.type === 'ArrowFunctionExpression' ||
							expression.type === 'FunctionExpression' ||
							expression.type === 'Identifier' ||
							expression.type === 'MemberExpression' ||
							expression.type === 'CallExpression';

            if (isFunction) {
              // Determine if it's inline or a reference
              const isInline =
								expression.type === 'ArrowFunctionExpression' ||
								expression.type === 'FunctionExpression';

              context.report({
                node,
                messageId: isInline ? 'noInlineEventHandler' : 'noEventHandlerInServer',
                data: { eventHandler: attributeName }
              });
            }
          }
          // Also check for JSXExpressionContainer with string literal (edge case)
          else if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
            // This is an edge case like onClick="someString", which isn't valid React but we should catch it
            context.report({
              node,
              messageId: 'noEventHandlerInServer',
              data: { eventHandler: attributeName }
            });
          }
        }
      }
    };
  }
};