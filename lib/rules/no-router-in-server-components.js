'use strict';

const CLIENT_ONLY_HOOKS = new Set(['useRouter', 'usePathname', 'useSearchParams', 'useParams']);

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow importing client-only navigation hooks from 'next/navigation' in Server Components",
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/api-reference/functions/use-router',
    },
    messages: {
      hookRequiresClient:
        "'{{hook}}' from 'next/navigation' only works in Client Components. Add \"use client\" to this file.",
    },
    schema: [],
  },

  create(context) {
    let hasUseClientDirective = false;

    return {
      Program(node) {
        // Check first non-empty statement for "use client"
        const first = node.body[0];
        if (
          first &&
          first.type === 'ExpressionStatement' &&
          first.expression.type === 'Literal' &&
          (first.expression.value === 'use client' || first.expression.value === 'use client;')
        ) {
          hasUseClientDirective = true;
        }
      },

      ImportDeclaration(node) {
        if (hasUseClientDirective) return;
        if (node.source.value !== 'next/navigation') return;

        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          const name = specifier.imported.name;
          if (CLIENT_ONLY_HOOKS.has(name)) {
            context.report({
              node: specifier,
              messageId: 'hookRequiresClient',
              data: { hook: name },
            });
          }
        }
      },
    };
  },
};
