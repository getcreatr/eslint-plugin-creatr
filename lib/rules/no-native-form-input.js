// lib/rules/no-native-form-input.js
'use strict';

const DEFAULT_MARKER = 'field-reason:';
const DEFAULT_MIN_REASON_LENGTH = 20;
const DEFAULT_ELEMENT_NAMES = ['input', 'Input'];

// type -> { component, import } the react-hook-form skill mandates instead.
// Native controls work, but lose the country selector, alpha channel,
// formatting and cross-browser consistency the shadcn equivalents provide.
const FORBIDDEN_TYPES = {
  date: { component: 'DatePicker', from: '@/components/ui/date-picker' },
  time: { component: 'TimePicker', from: '@/components/ui/time-picker' },
  'datetime-local': { component: 'DateTimePicker', from: '@/components/ui/date-picker' },
  color: { component: 'ColorPicker', from: '@/components/blocks/color-picker' },
  tel: { component: 'PhoneNumberInput', from: '@/components/ui/phone-input' },
};

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require the shadcn DatePicker/TimePicker/ColorPicker/PhoneNumberInput instead of a native input[type], unless the case carries a written reason',
      category: 'Forms',
      recommended: true,
      url: 'https://react-hook-form.com/',
    },
    messages: {
      nativeInput:
        'Use {{component}} from \'{{from}}\' instead of <{{element}} type="{{type}}">. The native control works, but loses the {{loses}} the shadcn component provides. If this case genuinely needs the native input, put a `{{marker}} <reason>` comment directly above it.',
      reasonTooShort:
        'The `{{marker}}` comment must say WHY the native input is needed — at least {{min}} characters. Got: "{{reason}}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          marker: { type: 'string' },
          minReasonLength: { type: 'integer', minimum: 0 },
          elementNames: { type: 'array', items: { type: 'string' } },
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
    const elementNames = options.elementNames || DEFAULT_ELEMENT_NAMES;

    const sourceCode = context.sourceCode || context.getSourceCode();

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !elementNames.includes(node.name.name)) {
          return;
        }

        const type = getStaticType(node);
        if (type === null || !Object.prototype.hasOwnProperty.call(FORBIDDEN_TYPES, type)) {
          return;
        }

        if (hasReasonComment(sourceCode, node, marker, minReasonLength, context)) {
          return;
        }

        const { component, from } = FORBIDDEN_TYPES[type];
        context.report({
          node,
          messageId: 'nativeInput',
          data: {
            component,
            from,
            element: node.name.name,
            type,
            loses: lossDescription(type),
            marker,
          },
        });
      },
    };
  },
};

// ---------------------------------------------------------------------------

const LOSS_DESCRIPTIONS = {
  color: 'alpha channel and eyedropper',
  tel: 'country selector and E.164 formatting',
};

function lossDescription(type) {
  return LOSS_DESCRIPTIONS[type] || 'formatting and cross-browser consistency';
}

function getTypeAttribute(node) {
  return node.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'type'
  );
}

/**
 * The `type` value ONLY when it is statically knowable — a plain string
 * literal or a single-quasi template literal. Returns null for `type={expr}`
 * or when there is no `type` attribute at all — both fall through as
 * "nothing to judge," matching no-raw-img-element's treatment of a dynamic
 * `src`. Unlike `src`, a dynamic `type` genuinely cannot be classified here.
 */
function getStaticType(node) {
  const attr = getTypeAttribute(node);
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

/**
 * True when a comment carrying the marker sits above this element AND its
 * reason is long enough. Reports `reasonTooShort` itself when the marker is
 * present but the reason is not. Mirrors no-raw-img-element's identical
 * helper — same marker-comment contract across both rules.
 */
function hasReasonComment(sourceCode, node, marker, minReasonLength, context) {
  const jsxElement = node.parent && node.parent.type === 'JSXElement' ? node.parent : node;

  const comments = [
    ...sourceCode.getCommentsBefore(jsxElement),
    ...sourceCode.getCommentsBefore(node),
  ];

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
