// lib/rules/require-server-action-metadata.js
'use strict';

/**
 * Require `.metadata({ actionName: '<exportName>' })` on every next-safe-action
 * server action, so each mutation gets a stable `server_action.<name>` span in
 * observability.
 *
 * TypeScript already makes `.metadata()` mandatory when the client defines a
 * metadata schema (TS2684), but this rule adds: (1) instant in-editor feedback,
 * (2) an autofix that inserts the call (tsc can't fix), and (3) enforcement that
 * `actionName` equals the export name (tsc can't check the string value).
 *
 * It flags `<client>.<...>.action(fn)` chains whose base identifier is a tracked
 * safe-action client (imported `action`/`authedAction` from `@/lib/safe-action`,
 * or a local derivation like `const adminAction = authedAction.use(...)`).
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require .metadata({ actionName }) on every next-safe-action server action',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/yourusername/eslint-plugin-creatr/blob/main/docs/rules/require-server-action-metadata.md',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          // Imported safe-action client identifiers to track.
          clients: {
            type: 'array',
            items: { type: 'string' },
            default: ['action', 'authedAction'],
          },
          // The module the clients are imported from.
          module: { type: 'string', default: '@/lib/safe-action' },
          // Also require actionName to equal the enclosing `export const <name>`.
          enforceActionName: { type: 'boolean', default: true },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingMetadata:
        'Server action is missing .metadata({ actionName }) — every action must name itself for tracing.',
      wrongActionName:
        'Server action metadata actionName {{ actual }} should match the export name {{ expected }}.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const clientNames = new Set(options.clients || ['action', 'authedAction']);
    const sourceModule = options.module || '@/lib/safe-action';
    const enforceActionName = options.enforceActionName !== false;

    // Identifiers known to be safe-action clients in this file: the imported
    // names + any local derivations (`const x = <client>.use(...)` / `= <client>`).
    const trackedClients = new Set();

    // ── chain helpers ──────────────────────────────────────────────────────
    // Descend a chain's object side to its base Identifier name.
    function getChainBase(objectNode) {
      let cur = objectNode;
      while (cur) {
        if (cur.type === 'Identifier') return cur.name;
        if (cur.type === 'CallExpression') {
          cur = cur.callee;
          continue;
        }
        if (cur.type === 'MemberExpression') {
          cur = cur.object;
          continue;
        }
        return null;
      }
      return null;
    }

    // Is there a `.metadata(...)` call anywhere in the object chain?
    function chainHasMetadata(objectNode) {
      let cur = objectNode;
      while (cur) {
        if (cur.type === 'CallExpression') {
          const callee = cur.callee;
          if (
            callee.type === 'MemberExpression' &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'metadata'
          ) {
            return cur;
          }
          cur = cur.callee;
          continue;
        }
        if (cur.type === 'MemberExpression') {
          cur = cur.object;
          continue;
        }
        return null;
      }
      return null;
    }

    // Climb to the enclosing `const <name> = ...` / `export const <name> = ...`
    // to get the action's name for the autofix / name check.
    function getEnclosingName(node) {
      let cur = node;
      while (cur && cur.type !== 'VariableDeclarator') {
        // stop if we leave the initializer (e.g. a function body) — no clean name
        if (
          cur.type === 'FunctionDeclaration' ||
          cur.type === 'Program' ||
          cur.type === 'BlockStatement'
        ) {
          return null;
        }
        cur = cur.parent;
      }
      if (cur && cur.id && cur.id.type === 'Identifier') return cur.id.name;
      return null;
    }

    return {
      // 1. Track imported client names from the safe-action module.
      ImportDeclaration(node) {
        if (node.source.value !== sourceModule) return;
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier' &&
            clientNames.has(spec.imported.name)
          ) {
            trackedClients.add(spec.local.name);
          }
        }
      },

      // 1b. Track local derivations: const x = <tracked>.use(...) | = <tracked>.
      VariableDeclarator(node) {
        if (!node.init || node.id.type !== 'Identifier') return;
        const base = getChainBase(node.init);
        if (base && trackedClients.has(base)) {
          trackedClients.add(node.id.name);
        }
      },

      // 2. Inspect every `<chain>.action(fn)` call.
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'action'
        ) {
          return;
        }

        const base = getChainBase(callee.object);
        if (!base || !trackedClients.has(base)) return; // not a safe-action chain

        const metadataCall = chainHasMetadata(callee.object);
        const exportName = getEnclosingName(node);

        // 3. Missing `.metadata()` → report (+ autofix when we know the name).
        if (!metadataCall) {
          context.report({
            node: callee.property,
            messageId: 'missingMetadata',
            fix(fixer) {
              if (!exportName) return null; // anonymous/inline — let the dev name it
              return fixer.insertTextAfter(
                callee.object,
                `.metadata({ actionName: '${exportName}' })`
              );
            },
          });
          return;
        }

        // 4. Enforce actionName === export name.
        if (!enforceActionName || !exportName) return;
        const arg = metadataCall.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;
        const prop = arg.properties.find(
          (p) =>
            p.type === 'Property' &&
            p.key.type === 'Identifier' &&
            p.key.name === 'actionName'
        );
        if (
          prop &&
          prop.value.type === 'Literal' &&
          typeof prop.value.value === 'string' &&
          prop.value.value !== exportName
        ) {
          context.report({
            node: prop.value,
            messageId: 'wrongActionName',
            data: { actual: prop.value.value, expected: exportName },
            fix(fixer) {
              return fixer.replaceText(prop.value, `'${exportName}'`);
            },
          });
        }
      },
    };
  },
};
