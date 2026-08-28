// lib/rules/no-imperative-navigation.js
'use strict';

const DEFAULT_MARKER = 'link-reason:';
const DEFAULT_MIN_REASON_LENGTH = 20;
const DEFAULT_IGNORE_PATHS = [];

// `push` only by default. `replace` is legitimate far more often — URL-state
// writes, modal dismissal, post-mutation redirects — and reporting it leans hard
// on exemption-detection being right. Opt in with `{ methods: ['push','replace'] }`.
const DEFAULT_METHODS = ['push'];

// Property names whose callbacks run AFTER a mutation resolved. The target URL
// frequently does not exist until the server answers (`data.id`), so a <Link>
// cannot express it. Covers post-mutation redirects and auth/wizard transitions.
const MUTATION_CALLBACKS = ['onSuccess', 'onError'];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require <Link> for navigation instead of router.push, unless the case is provably imperative or carries a written reason',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/api-reference/components/link',
    },
    messages: {
      imperativeNav:
        'Navigate with <Link href> instead of router.{{method}}(). A <Link> is a real anchor: it prefetches, and it gives middle-click, cmd-click, right-click "copy link" and "open in new tab" for free — an onClick handler gives none of them, and a div with role="link" has to reimplement keyboard support by hand. A dynamic href is NOT a reason to avoid it. If this navigation genuinely cannot be a link — no href until a server call returns, an API that takes a callback, a drag handle — put a `{{marker}} <reason>` comment directly above it.',
      reasonTooShort:
        'The `{{marker}}` comment must say WHY a link is impossible here — at least {{min}} characters, and "dynamic" or "programmatic" alone is not a reason (a dynamic href works fine with <Link href={`/items/${id}`}>). Got: "{{reason}}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          marker: { type: 'string' },
          minReasonLength: { type: 'integer', minimum: 0 },
          methods: { type: 'array', items: { type: 'string' } },
          ignorePaths: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const marker = options.marker || DEFAULT_MARKER;
    const minReasonLength =
      typeof options.minReasonLength === 'number'
        ? options.minReasonLength
        : DEFAULT_MIN_REASON_LENGTH;
    const methods = options.methods || DEFAULT_METHODS;
    const ignorePaths = options.ignorePaths || DEFAULT_IGNORE_PATHS;

    const filename = normalizeFilename(context);
    if (ignorePaths.some((p) => filename.includes(p))) return {};

    const sourceCode = context.sourceCode || context.getSourceCode();

    // Variables assigned from useRouter(). `no-hardcoded-redirect-urls` matches the
    // bare name `router` only, so `const r = useRouter()` slips past it.
    const routerVars = new Set();

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          node.init.callee.name === 'useRouter'
        ) {
          routerVars.add(node.id.name);
        }
      },

      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (!methods.includes(callee.property.name)) return;
        if (callee.object.type !== 'Identifier') return;

        // Resolved from useRouter(), or conventionally named `router`.
        if (!routerVars.has(callee.object.name) && callee.object.name !== 'router') {
          return;
        }

        // `{ scroll: false }` is the URL-state write of §3.6 — filter/sort/page
        // state going into searchParams. Measured across a generated app: it
        // appears on every one of those and on nothing else.
        if (hasScrollFalse(node.arguments[1])) return;

        // Post-mutation redirect: the href often does not exist until the action
        // returns, so there is nothing to put in a <Link>.
        if (isInsideCallbackNamed(node, MUTATION_CALLBACKS)) return;

        // Sequenced after an await in the same function. A <Link> navigates on
        // click; it cannot express "go there once this async step resolves".
        if (followsAwait(node)) return;

        const method = callee.property.name;

        if (hasReasonComment(sourceCode, node, marker, minReasonLength, context, method)) {
          return;
        }

        context.report({ node, messageId: 'imperativeNav', data: { marker, method } });
      },
    };
  },
};

// ---------------------------------------------------------------------------

function normalizeFilename(context) {
  const raw =
    (typeof context.filename === 'string' && context.filename) ||
    (typeof context.getFilename === 'function' && context.getFilename()) ||
    '';
  return raw.split('\\').join('/');
}

/** True for a `{ scroll: false }` options argument. */
function hasScrollFalse(arg) {
  if (!arg || arg.type !== 'ObjectExpression') return false;
  return arg.properties.some(
    (p) =>
      p.type === 'Property' &&
      !p.computed &&
      ((p.key.type === 'Identifier' && p.key.name === 'scroll') ||
        (p.key.type === 'Literal' && p.key.value === 'scroll')) &&
      p.value.type === 'Literal' &&
      p.value.value === false
  );
}

/**
 * True when any ancestor is a callback named one of these — as an object property
 * (`useAction(x, { onSuccess: … })`) OR as a JSX prop (`<Form onSuccess={…} />`).
 * Both shapes occur; matching only the first misses the JSX one entirely.
 */
function isInsideCallbackNamed(node, names) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (cur.type === 'Property' && !cur.computed) {
      const key = cur.key;
      const name =
        (key.type === 'Identifier' && key.name) ||
        (key.type === 'Literal' && key.value);
      if (names.includes(name)) return true;
    }
    if (cur.type === 'JSXAttribute' && cur.name && cur.name.type === 'JSXIdentifier') {
      if (names.includes(cur.name.name)) return true;
    }
  }
  return false;
}

/** True when an `await` completes earlier in the same function body. */
function followsAwait(node) {
  let fn = node.parent;
  while (fn && !/Function/.test(fn.type)) fn = fn.parent;
  if (!fn || !fn.async) return false;

  let found = false;
  (function walk(n) {
    if (found || !n || typeof n.type !== 'string') return;
    if (n !== fn && /Function/.test(n.type)) return; // don't descend into nested fns
    if (n.type === 'AwaitExpression' && n.range && node.range && n.range[1] < node.range[0]) {
      found = true;
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === 'parent') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v.type === 'string') walk(v);
    }
  })(fn);
  return found;
}

/**
 * A `router.push` can sit in several shapes, and the reason comment goes above
 * whichever one the author was looking at. Collect every plausible anchor:
 * the call, its statement, the JSX attribute holding it, and the JSX element.
 */
function reasonAnchors(node) {
  const anchors = [node];
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (
      cur.type === 'ExpressionStatement' ||
      cur.type === 'VariableDeclaration' ||
      cur.type === 'ReturnStatement' ||
      cur.type === 'JSXAttribute' ||
      cur.type === 'Property' ||
      cur.type === 'JSXElement'
    ) {
      anchors.push(cur);
    }
    if (cur.type === 'JSXElement') break;
    if (cur.type === 'Program') break;
  }
  return anchors;
}

/**
 * True when a comment carrying the marker sits above this call AND its reason is
 * long enough. Reports `reasonTooShort` itself when the marker is present but the
 * reason is not, so a stub annotation is called out specifically.
 */
function hasReasonComment(sourceCode, node, marker, minReasonLength, context, method) {
  const anchors = reasonAnchors(node);
  const comments = [];
  for (const a of anchors) comments.push(...sourceCode.getCommentsBefore(a));

  // A JSX comment is a Block comment inside a JSXExpressionContainer sibling,
  // which getCommentsBefore does not reach. Walk back through the siblings.
  const jsxElement = anchors.find((a) => a.type === 'JSXElement');
  if (jsxElement && jsxElement.parent && Array.isArray(jsxElement.parent.children)) {
    const kids = jsxElement.parent.children;
    const index = kids.indexOf(jsxElement);
    for (let i = index - 1; i >= 0; i--) {
      const sibling = kids[i];
      if (sibling.type === 'JSXText' && sibling.value.trim() === '') continue;
      if (sibling.type === 'JSXExpressionContainer') {
        comments.push(...sourceCode.getCommentsInside(sibling));
      }
      break;
    }
  }

  for (const comment of comments) {
    const idx = comment.value.indexOf(marker);
    if (idx === -1) continue;

    const reason = comment.value
      .slice(idx + marker.length)
      .replace(/\*+\/?\s*$/, '')
      .trim();

    if (reason.length >= minReasonLength) return true;

    context.report({
      node,
      messageId: 'reasonTooShort',
      data: { marker, min: String(minReasonLength), reason, method },
    });
    return true;
  }

  return false;
}
