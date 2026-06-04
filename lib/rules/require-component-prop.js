'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a specific prop on configured JSX components (e.g. value on SelectItem)',
      category: 'React',
      recommended: false,
    },
    messages: {
      missingProp: '<{{component}}> is missing a required "{{prop}}" prop.',
      emptyProp: '<{{component}}> has an empty "{{prop}}" prop. Use a non-empty value.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                prop: { type: 'string' },
              },
              required: ['name', 'prop'],
              additionalProperties: false,
            },
          },
        },
        required: ['components'],
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0];
    if (!options || !options.components || options.components.length === 0) {
      return {};
    }

    // Build lookup: component display name → required prop name
    const configMap = new Map();
    for (const { name, prop } of options.components) {
      configMap.set(name, prop);
    }

    return {
      JSXOpeningElement(node) {
        const componentName = getComponentName(node);
        if (!componentName) return;

        const requiredProp = configMap.get(componentName);
        if (!requiredProp) return;

        const hasSpread = node.attributes.some(
          (a) => a.type === 'JSXSpreadAttribute'
        );

        const propAttr = node.attributes.find(
          (a) => a.type === 'JSXAttribute' && a.name.name === requiredProp
        );

        if (!propAttr) {
          if (!hasSpread) {
            context.report({
              node,
              messageId: 'missingProp',
              data: { component: componentName, prop: requiredProp },
            });
          }
          return;
        }

        if (isEmptyString(propAttr.value)) {
          context.report({
            node: propAttr,
            messageId: 'emptyProp',
            data: { component: componentName, prop: requiredProp },
          });
        }
      },
    };
  },
};

function getComponentName(node) {
  const { name } = node;
  if (name.type === 'JSXIdentifier') {
    return name.name;
  }
  if (
    name.type === 'JSXMemberExpression' &&
    name.object.type === 'JSXIdentifier' &&
    name.property.type === 'JSXIdentifier'
  ) {
    return `${name.object.name}.${name.property.name}`;
  }
  return null;
}

function isEmptyString(value) {
  if (!value) return false;
  // value=""
  if (value.type === 'Literal' && value.value === '') return true;
  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;
    // value={""}
    if (expr.type === 'Literal' && expr.value === '') return true;
    // value={``}
    if (
      expr.type === 'TemplateLiteral' &&
      expr.quasis.length === 1 &&
      expr.quasis[0].value.cooked === ''
    ) {
      return true;
    }
  }
  return false;
}
