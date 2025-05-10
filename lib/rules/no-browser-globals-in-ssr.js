'use strict';

const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent usage of browser globals in contexts that might run during SSR',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/your-org/eslint-plugin-creatr/blob/main/docs/rules/no-browser-globals-in-ssr.md',
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowInClientComponents: {
            type: 'boolean',
            default: false,
          },
          allowInEffects: {
            type: 'boolean',
            default: true,
          },
          allowInEventHandlers: {
            type: 'boolean',
            default: true,
          },
          allowWithTypeCheck: {
            type: 'boolean',
            default: true,
          },
          additionalGlobals: {
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
    const {
      allowInClientComponents = false,
      allowInEffects = true,
      allowInEventHandlers = true,
      allowWithTypeCheck = true,
      additionalGlobals = [],
    } = options;

    const browserGlobals = [...BROWSER_GLOBALS, ...additionalGlobals];
    const sourceCode = context.getSourceCode();

    // Track if we're in a client component
    let isClientComponent = false;

    // Helper function to check if node is inside a specific function call
    function isInsideFunctionCall(node, functionNames) {
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === 'CallExpression' &&
					parent.callee.type === 'Identifier' &&
					functionNames.includes(parent.callee.name)
        ) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    // Check if we're inside useEffect or similar hooks
    function isInsideEffect(node) {
      return isInsideFunctionCall(node, [
        'useEffect',
        'useLayoutEffect',
        'useInsertionEffect',
      ]);
    }

    // Check if we're inside an event handler
    function isInsideEventHandler(node) {
      let parent = node.parent;
      while (parent) {
        // Check for JSX attribute that looks like an event handler  
        if (
          parent.type === 'JSXAttribute' &&
					parent.name.type === 'JSXIdentifier' &&
					(
					  /^on[A-Z]/.test(parent.name.name) || // onClick, onChange, etc.
						parent.name.name === 'action' || // form action
						parent.name.name === 'ref' // ref callbacks
					)
        ) {
          return true;
        }

        // Check if we're in a function that's being passed as an event handler
        if (
          (parent.type === 'FunctionExpression' ||
						parent.type === 'ArrowFunctionExpression' ||
						parent.type === 'FunctionDeclaration') &&
					parent.parent
        ) {
          let functionParent = parent.parent;

          // Check if the function is assigned to a variable with an event handler name
          if (
            functionParent.type === 'VariableDeclarator' &&
						functionParent.id.type === 'Identifier' &&
						/^(handle|on)[A-Z]/.test(functionParent.id.name)
          ) {
            return true;
          }

          // Check if the function is being passed as a prop that looks like an event handler
          if (
            functionParent.type === 'JSXExpressionContainer' &&
						functionParent.parent.type === 'JSXAttribute' &&
						functionParent.parent.name.type === 'JSXIdentifier' &&
						(
						  /^on[A-Z]/.test(functionParent.parent.name.name) ||
							functionParent.parent.name.name === 'action'
						)
          ) {
            return true;
          }
        }

        // Check for object property that looks like an event handler
        if (
          parent.type === 'Property' &&
					parent.key.type === 'Identifier' &&
					/^on[A-Z]/.test(parent.key.name)
        ) {
          return true;
        }

        // Check for assignment to event handler property
        if (
          parent.type === 'AssignmentExpression' &&
					parent.left.type === 'MemberExpression' &&
					parent.left.property.type === 'Identifier' &&
					/^on[A-Z]/.test(parent.left.property.name)
        ) {
          return true;
        }

        parent = parent.parent;
      }
      return false;
    }

    // Check if the global is wrapped in a typeof check
    function isWrappedInTypeCheck(node) {
      let parent = node.parent;

      // Check if we're directly inside a typeof operator
      if (
        parent &&
				parent.type === 'UnaryExpression' &&
				parent.operator === 'typeof' &&
				parent.argument === node
      ) {
        return true;
      }

      return false;
    }

    // Check if we're in a client-only context (like after a client-side check)
    function isInClientOnlyContext(node) {
      let parent = node.parent;
      while (parent) {
        // Check for if statements that check for browser environment
        if (parent.type === 'IfStatement') {
          const test = parent.test;
          if (
            test.type === 'BinaryExpression' &&
						(test.operator === '!==' || test.operator === '!==') &&
						test.left.type === 'UnaryExpression' &&
						test.left.operator === 'typeof' &&
						test.left.argument.type === 'Identifier' &&
						browserGlobals.includes(test.left.argument.name) &&
						test.right.type === 'Literal' &&
						test.right.value === 'undefined'
          ) {
            // Check if we're in the consequent (if branch)
            if (parent.consequent && isAncestor(parent.consequent, node)) {
              return true;
            }
          }
        }

        // Check for ternary expressions
        if (
          parent.type === 'ConditionalExpression' &&
					parent.test.type === 'BinaryExpression' &&
					(parent.test.operator === '!==' || parent.test.operator === '!==') &&
					parent.test.left.type === 'UnaryExpression' &&
					parent.test.left.operator === 'typeof' &&
					parent.test.left.argument.type === 'Identifier' &&
					browserGlobals.includes(parent.test.left.argument.name) &&
					parent.test.right.type === 'Literal' &&
					parent.test.right.value === 'undefined'
        ) {
          // We're in the consequent branch of a ternary that checks for browser
          if (parent.consequent && isAncestor(parent.consequent, node)) {
            return true;
          }
        }

        parent = parent.parent;
      }
      return false;
    }

    // Helper to check if one node is an ancestor of another
    function isAncestor(ancestor, descendant) {
      let parent = descendant;
      while (parent) {
        if (parent === ancestor) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      Program(node) {
        // Check for "use client" directive at the top of the file
        const firstNode = node.body[0];
        if (
          firstNode &&
					firstNode.type === 'ExpressionStatement' &&
					firstNode.expression.type === 'Literal' &&
					firstNode.expression.value === 'use client'
        ) {
          isClientComponent = true;
        }
      },

      Identifier(node) {
        // Skip if not a browser global
        if (!browserGlobals.includes(node.name)) {
          return;
        }

        // Skip if it's a property name (e.g., obj.window)
        if (node.parent.type === 'MemberExpression' && node.parent.property === node) {
          return;
        }

        // Skip if it's a property key in an object
        if (node.parent.type === 'Property' && node.parent.key === node) {
          return;
        }

        // Skip if it's a function parameter
        if (
          node.parent.type === 'FunctionDeclaration' ||
					node.parent.type === 'FunctionExpression' ||
					node.parent.type === 'ArrowFunctionExpression'
        ) {
          if (node.parent.params.includes(node)) {
            return;
          }
        }

        // Skip if it's being declared as a variable
        if (node.parent.type === 'VariableDeclarator' && node.parent.id === node) {
          return;
        }

        // Check if this is a variable that shadows a browser global
        // (e.g., function parameter or local variable with same name)
        let scope = sourceCode.getScope ? sourceCode.getScope(node) : context.getScope();
        while (scope) {
          const variable = scope.variables.find(v => v.name === node.name);
          if (variable && variable.defs.length > 0) {
            // This is a local variable/parameter that shadows the global
            return;
          }
          scope = scope.upper;
        }

        // Check if the usage is allowed based on context
        if (allowInClientComponents && isClientComponent) {
          return;
        }

        if (allowInEffects && isInsideEffect(node)) {
          return;
        }

        if (allowInEventHandlers && isInsideEventHandler(node)) {
          return;
        }

        if (allowWithTypeCheck && (isWrappedInTypeCheck(node) || isInClientOnlyContext(node))) {
          return;
        }

        // Report the error
        context.report({
          node,
          message: `'${node.name}' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.`,
          data: {
            name: node.name,
          },
        });
      },
    };
  },
};