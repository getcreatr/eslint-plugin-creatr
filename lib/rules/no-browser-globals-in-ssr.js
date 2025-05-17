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
            default: true,
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

    // Track variables that store browser environment checks
    const browserCheckVariables = new Set();

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

    // New helper: Check if the node is inside a default parameter value
    function isInDefaultParameterValue(node) {
      let current = node;
      while (current && current.parent) {
        // Direct default parameter
        if (current.parent.type === 'AssignmentPattern' && current.parent.right === current) {
          return true;
        }

        // Handle nested MemberExpressions (e.g., window.location.href)
        if (current.parent.type === 'MemberExpression' && current.parent.object === current) {
          current = current.parent;
        } else {
          break;
        }
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

    // Helper to find a condition that checks if a browser global is defined
    function isBrowserGlobalTypeCheck(test, globalName) {
      if (
        test.type === 'BinaryExpression' &&
        (test.operator === '!==' || test.operator === '!=') &&
        test.left.type === 'UnaryExpression' &&
        test.left.operator === 'typeof' &&
        test.left.argument.type === 'Identifier' &&
        (globalName === null || test.left.argument.name === globalName) &&
        test.right.type === 'Literal' &&
        test.right.value === 'undefined'
      ) {
        return true;
      }
      return false;
    }

    // Track variables that store browser environment checks
    function trackBrowserCheckVariables(node) {
      if (node.type !== 'VariableDeclarator' || !node.init) {
        return;
      }

      // Check for pattern like: const isBrowser = typeof window !== 'undefined'
      if (
        node.id.type === 'Identifier' &&
        node.init.type === 'BinaryExpression' &&
        (node.init.operator === '!==' || node.init.operator === '!=') &&
        node.init.left &&
        node.init.left.type === 'UnaryExpression' &&
        node.init.left.operator === 'typeof' &&
        node.init.left.argument &&
        node.init.left.argument.type === 'Identifier' &&
        browserGlobals.includes(node.init.left.argument.name) &&
        node.init.right.type === 'Literal' &&
        node.init.right.value === 'undefined'
      ) {
        // Add this variable name to our set of browser check variables
        browserCheckVariables.add(node.id.name);
      }

      // Check for variable assignments from existing browser check variables
      // e.g., const newVar = isBrowser;
      if (
        node.id.type === 'Identifier' &&
        node.init.type === 'Identifier' &&
        browserCheckVariables.has(node.init.name)
      ) {
        browserCheckVariables.add(node.id.name);
      }
    }

    // Check if we're in a client-only context (like after a client-side check)
    function isInClientOnlyContext(node) {
      let parent = node.parent;

      // Track the globals that have been checked in the current context
      const checkedGlobals = new Set();
      const nodeName = node.name;

      // Find all blocks that are guarded by browser check variables
      function isInsideBrowserCheckBlock() {
        let current = node;
        while (current && current.parent) {
          // Check if we're in a block that's inside an if statement with a browser check variable
          if (current.parent.type === 'BlockStatement' &&
            current.parent.parent &&
            current.parent.parent.type === 'IfStatement' &&
            current.parent.parent.consequent === current.parent) {

            const test = current.parent.parent.test;

            // Direct browser check variable as condition
            if (test.type === 'Identifier' && browserCheckVariables.has(test.name)) {
              return true;
            }

            // Handle logical expressions that might include browser check variables
            if (test.type === 'LogicalExpression') {
              if (containsBrowserCheckVariable(test)) {
                return true;
              }
            }
          }

          current = current.parent;
        }
        return false;
      }

      // Check if a logical expression contains a browser check variable
      function containsBrowserCheckVariable(expr) {
        if (expr.type === 'Identifier' && browserCheckVariables.has(expr.name)) {
          return true;
        }

        if (expr.type === 'LogicalExpression') {
          return containsBrowserCheckVariable(expr.left) || containsBrowserCheckVariable(expr.right);
        }

        return false;
      }

      // First check if we're inside a block guarded by a browser check variable
      if (isInsideBrowserCheckBlock()) {
        return true;
      }

      while (parent) {
        // Check for if statements with browser check variables
        if (parent.type === 'IfStatement') {
          const test = parent.test;

          // Check if condition is a browser check variable
          if (
            test.type === 'Identifier' &&
            browserCheckVariables.has(test.name) &&
            parent.consequent &&
            isAncestor(parent.consequent, node)
          ) {
            return true;
          }

          // Direct check for the specific global
          if (isBrowserGlobalTypeCheck(test, nodeName)) {
            // We're in the consequent (if branch) checking for this specific global
            if (parent.consequent && isAncestor(parent.consequent, node)) {
              return true;
            }
          }

          // Handle logical AND expressions for combined checks
          else if (test.type === 'LogicalExpression' && test.operator === '&&') {
            // Collect all the globals being checked in this condition
            const checkedInCondition = collectGlobalsFromLogicalExpression(test);

            // If the node's name is in the checked globals and we're in the consequent
            if (checkedInCondition.has(nodeName) && parent.consequent && isAncestor(parent.consequent, node)) {
              return true;
            }

            // If we're in the consequent, add all checked globals to our running set
            if (parent.consequent && isAncestor(parent.consequent, node)) {
              checkedInCondition.forEach(global => checkedGlobals.add(global));
            }
          }
        }

        // Handle ternary expressions
        else if (parent.type === 'ConditionalExpression') {
          const test = parent.test;

          // Check if condition is a browser check variable
          if (
            test.type === 'Identifier' &&
            browserCheckVariables.has(test.name) &&
            parent.consequent &&
            isAncestor(parent.consequent, node)
          ) {
            return true;
          }

          // Direct check for a specific global
          if (isBrowserGlobalTypeCheck(test, nodeName)) {
            // We're in the consequent branch of a ternary that checks for this global
            if (parent.consequent && isAncestor(parent.consequent, node)) {
              return true;
            }
          }

          // Handle combined checks in ternary
          else if (test.type === 'LogicalExpression' && test.operator === '&&') {
            const checkedInCondition = collectGlobalsFromLogicalExpression(test);

            if (checkedInCondition.has(nodeName) && parent.consequent && isAncestor(parent.consequent, node)) {
              return true;
            }

            // If we're in the consequent, add all checked globals to our running set
            if (parent.consequent && isAncestor(parent.consequent, node)) {
              checkedInCondition.forEach(global => checkedGlobals.add(global));
            }
          }
        }

        // Handle nested if statements by checking the collected globals
        else if (
          parent.type === 'BlockStatement' &&
          parent.parent &&
          parent.parent.type === 'IfStatement' &&
          parent.parent.consequent === parent
        ) {
          const test = parent.parent.test;

          // Check if the condition is a browser check variable
          if (
            test.type === 'Identifier' &&
            browserCheckVariables.has(test.name)
          ) {
            return true;
          }

          if (test.type === 'BinaryExpression' &&
            (test.operator === '!==' || test.operator === '!=') &&
            test.left.type === 'UnaryExpression' &&
            test.left.operator === 'typeof' &&
            test.left.argument.type === 'Identifier' &&
            browserGlobals.includes(test.left.argument.name) &&
            test.right.type === 'Literal' &&
            test.right.value === 'undefined'
          ) {
            // Add this checked global to our set
            checkedGlobals.add(test.left.argument.name);

            // If this is the global we're looking for, then we're safe
            if (test.left.argument.name === nodeName) {
              return true;
            }
          }

          // Handle logical expressions in nested if statements
          else if (test.type === 'LogicalExpression' && test.operator === '&&') {
            const checkedInCondition = collectGlobalsFromLogicalExpression(test);

            if (checkedInCondition.has(nodeName)) {
              return true;
            }

            // Add all checked globals to our running set
            checkedInCondition.forEach(global => checkedGlobals.add(global));
          }
        }

        parent = parent.parent;
      }

      // If we've collected checks for this global through the ancestry chain
      return checkedGlobals.has(nodeName);
    }

    // Helper function to collect all browser globals being checked in a logical expression
    function collectGlobalsFromLogicalExpression(expr) {
      const checkedGlobals = new Set();

      // Base case: direct typeof check
      if (expr.type === 'BinaryExpression' &&
        (expr.operator === '!==' || expr.operator === '!=') &&
        expr.left.type === 'UnaryExpression' &&
        expr.left.operator === 'typeof' &&
        expr.left.argument.type === 'Identifier' &&
        browserGlobals.includes(expr.left.argument.name) &&
        expr.right.type === 'Literal' &&
        expr.right.value === 'undefined') {

        checkedGlobals.add(expr.left.argument.name);
      }

      // Recursive case: AND operator connecting multiple checks
      else if (expr.type === 'LogicalExpression' && expr.operator === '&&') {
        // Check left side
        if (expr.left.type === 'BinaryExpression') {
          if (expr.left.left &&
            expr.left.left.type === 'UnaryExpression' &&
            expr.left.left.operator === 'typeof' &&
            expr.left.left.argument.type === 'Identifier' &&
            browserGlobals.includes(expr.left.left.argument.name) &&
            expr.left.right.type === 'Literal' &&
            expr.left.right.value === 'undefined' &&
            (expr.left.operator === '!==' || expr.left.operator === '!=')) {

            checkedGlobals.add(expr.left.left.argument.name);
          }
        } else if (expr.left.type === 'LogicalExpression') {
          const leftGlobals = collectGlobalsFromLogicalExpression(expr.left);
          leftGlobals.forEach(global => checkedGlobals.add(global));
        }

        // Check right side
        if (expr.right.type === 'BinaryExpression') {
          if (expr.right.left &&
            expr.right.left.type === 'UnaryExpression' &&
            expr.right.left.operator === 'typeof' &&
            expr.right.left.argument.type === 'Identifier' &&
            browserGlobals.includes(expr.right.left.argument.name) &&
            expr.right.right.type === 'Literal' &&
            expr.right.right.value === 'undefined' &&
            (expr.right.operator === '!==' || expr.right.operator === '!=')) {

            checkedGlobals.add(expr.right.left.argument.name);
          }
        } else if (expr.right.type === 'LogicalExpression') {
          const rightGlobals = collectGlobalsFromLogicalExpression(expr.right);
          rightGlobals.forEach(global => checkedGlobals.add(global));
        }
      }

      return checkedGlobals;
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

      VariableDeclarator(node) {
        // Track browser check variables
        trackBrowserCheckVariables(node);
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

        // Check if it's in a default parameter value and in a client component
        if (isInDefaultParameterValue(node) && allowInClientComponents && isClientComponent) {
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