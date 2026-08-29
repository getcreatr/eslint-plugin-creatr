'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow redirect() or router.push/replace() calls with URLs that do not start with /',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/api-reference/functions/redirect'
    },
    messages: {
      relativeRedirect: 'redirect() called with "{{value}}" which doesn\'t start with /. Use an absolute path like "/{{value}}" to avoid unexpected navigation.',
      relativeRouterPush: 'router.{{method}}() called with "{{value}}" which doesn\'t start with /. Use an absolute path to avoid unexpected navigation.',
    },
    schema: []
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        const args = node.arguments;

        if (!args || args.length === 0) return;

        const firstArg = args[0];

        // Check if it's redirect(...)
        if (callee.type === 'Identifier' && callee.name === 'redirect') {
          const problematicValue = getProblematicValue(firstArg);
          if (problematicValue !== null) {
            context.report({
              node,
              messageId: 'relativeRedirect',
              data: { value: problematicValue },
            });
          }
          return;
        }

        // Check if it's router.push(...) or router.replace(...)
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'router' &&
          callee.property.type === 'Identifier' &&
          ['push', 'replace'].includes(callee.property.name)
        ) {
          const method = callee.property.name;
          const problematicValue = getProblematicValue(firstArg);
          if (problematicValue !== null) {
            context.report({
              node,
              messageId: 'relativeRouterPush',
              data: { method, value: problematicValue },
            });
          }
        }
      }
    };
  }
};

/**
 * Returns true if the URL string is safe — starts with '/', 'http://', or 'https://'.
 * External URLs are intentional redirects and should not be flagged.
 */
function isSafeUrl(value) {
  return (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}

/**
 * Returns the display value if the argument is a string/template literal that
 * is NOT a safe URL (i.e. a relative path without a leading /). Returns null if OK.
 */
function getProblematicValue(arg) {
  if (!arg) return null;

  if (arg.type === 'Literal' && typeof arg.value === 'string') {
    if (!isSafeUrl(arg.value)) {
      return arg.value;
    }
    return null;
  }

  if (arg.type === 'TemplateLiteral') {
    const firstQuasi = arg.quasis[0];
    // Empty first quasi means the literal starts with an expression (e.g. `${url}/path`).
    // The value is dynamic — skip it to avoid false positives.
    if (firstQuasi && firstQuasi.value.raw !== '' && !isSafeUrl(firstQuasi.value.raw)) {
      // Build display value: raw text of first quasi + '...' if there are expressions
      const displayValue = arg.expressions.length > 0
        ? firstQuasi.value.raw + '...'
        : firstQuasi.value.raw;
      return displayValue;
    }
    return null;
  }

  return null;
}
