// lib/rules/no-raw-img-element.js
'use strict';

const DEFAULT_MARKER = 'img-reason:';
const DEFAULT_MIN_REASON_LENGTH = 20;
const DEFAULT_IGNORE_PATHS = ['src/emails/'];

// app/ metadata file conventions. Next.js renders these to an image, and its own
// no-img-element rule exempts them for the same reason: <Image> cannot run there.
const METADATA_FILE = /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)(\.\w+)?\.(jsx?|tsx?)$/;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require next/image instead of a raw <img>, unless the case is provably unoptimisable or carries a written reason',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/api-reference/components/image',
    },
    messages: {
      rawImg:
        'Use <Image> from next/image instead of <img>. It serves WebP/AVIF, generates responsive sizes, lazy-loads below the fold, and reserves space so the layout does not shift. In a fixed-size container use `fill` with `sizes`; where the intrinsic size is known use `width` and `height`. A dynamic src is NOT a reason to avoid <Image>. If this case genuinely needs a raw <img>, put a `{{marker}} <reason>` comment directly above it.',
      reasonTooShort:
        'The `{{marker}}` comment must say WHY a raw <img> is needed — at least {{min}} characters, and "dynamic" or "user upload" alone is not a reason (a dynamic src works fine with `fill` + `sizes`). Got: "{{reason}}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          marker: { type: 'string' },
          minReasonLength: { type: 'integer', minimum: 0 },
          allowSvg: { type: 'boolean' },
          allowDataUri: { type: 'boolean' },
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
    const allowSvg = options.allowSvg !== false;
    const allowDataUri = options.allowDataUri !== false;
    const ignorePaths = options.ignorePaths || DEFAULT_IGNORE_PATHS;

    const filename = normalizeFilename(context);

    // Whole-file exemptions — cheap, so check once rather than per element.
    if (METADATA_FILE.test(filename)) return {};
    if (ignorePaths.some((p) => filename.includes(p))) return {};

    const sourceCode = context.sourceCode || context.getSourceCode();

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'img') {
          return;
        }

        // <picture> owns art direction; its <img> is the required fallback child.
        if (isPictureChild(node)) return;

        // No `src` attribute at all — e.g. `<img {...props} />`, a forwarding
        // wrapper. There is nothing to judge, and the caller is the real site.
        if (!getSrcAttribute(node)) return;

        const src = getStaticSrc(node);

        // An SVG is already a vector — optimisation has nothing to do.
        if (allowSvg && src !== null && isSvgPath(src)) return;

        // data:/blob: is a local preview (crop, pre-upload). There is no URL for
        // the optimiser to fetch, and next/image cannot process one.
        if (allowDataUri && src !== null && isInlineUri(src)) return;

        if (hasReasonComment(sourceCode, node, marker, minReasonLength, context)) {
          return;
        }

        context.report({ node, messageId: 'rawImg', data: { marker } });
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

function getSrcAttribute(node) {
  return node.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'src'
  );
}

/**
 * The `src` value ONLY when it is statically knowable — a plain string literal or
 * a single-quasi template literal. Returns null for `src={expr}`, which is
 * deliberate: a dynamic src is not an excuse, so it falls through to the report.
 * Callers must rule out "no src attribute" separately — that is a different case.
 */
function getStaticSrc(node) {
  const attr = getSrcAttribute(node);
  if (!attr || !attr.value) return null;

  if (attr.value.type === 'Literal') {
    return typeof attr.value.value === 'string' ? attr.value.value : null;
  }
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr.type === 'Literal' && typeof expr.value === 'string') {
      return expr.value;
    }
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
      return expr.quasis[0].value.cooked;
    }
  }
  return null;
}

function isSvgPath(src) {
  // Strip ?query and #hash before testing the extension.
  const path = src.split('?')[0].split('#')[0];
  return path.toLowerCase().endsWith('.svg');
}

function isInlineUri(src) {
  const s = src.trim().toLowerCase();
  return s.startsWith('data:') || s.startsWith('blob:');
}

function isPictureChild(node) {
  const jsxElement = node.parent;
  if (!jsxElement || jsxElement.type !== 'JSXElement') return false;
  const parent = jsxElement.parent;
  if (!parent || parent.type !== 'JSXElement') return false;
  const openingName = parent.openingElement && parent.openingElement.name;
  return !!openingName && openingName.type === 'JSXIdentifier' && openingName.name === 'picture';
}

/**
 * True when a comment carrying the marker sits above this element AND its reason
 * is long enough. Reports `reasonTooShort` itself when the marker is present but
 * the reason is not, so a stub annotation is called out specifically rather than
 * falling through to the generic message.
 */
function hasReasonComment(sourceCode, node, marker, minReasonLength, context) {
  // The element that owns any leading comments: <img/> itself, or the
  // {/* … */} JSXExpressionContainer that precedes it inside JSX children.
  const jsxElement = node.parent && node.parent.type === 'JSXElement' ? node.parent : node;

  const comments = [
    ...sourceCode.getCommentsBefore(jsxElement),
    ...sourceCode.getCommentsBefore(node),
  ];

  // A JSX comment is a Block comment inside a JSXExpressionContainer sibling,
  // which getCommentsBefore does not reach. Walk back through the siblings.
  const container = jsxElement.parent;
  if (container && Array.isArray(container.children)) {
    const index = container.children.indexOf(jsxElement);
    for (let i = index - 1; i >= 0; i--) {
      const sibling = container.children[i];
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
      data: { marker, min: String(minReasonLength), reason },
    });
    return true;
  }

  return false;
}
