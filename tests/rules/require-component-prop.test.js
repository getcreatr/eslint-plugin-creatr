import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/require-component-prop.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

const selectConfig = {
  components: [
    { name: 'SelectItem', prop: 'value' },
    { name: 'Select.Item', prop: 'value' },
  ],
};

describe('require-component-prop rule', () => {
  ruleTester.run('require-component-prop', rule, {
    valid: [
      // ── SelectItem with valid value ──────────────────────────────────────
      { code: '<SelectItem value="apple">Apple</SelectItem>', options: [selectConfig] },
      { code: '<Select.Item value="apple">Apple</Select.Item>', options: [selectConfig] },
      // dynamic expression — not statically empty
      { code: '<SelectItem value={itemId} />', options: [selectConfig] },
      { code: '<Select.Item value={item.value} />', options: [selectConfig] },
      // spread present — value may come from props
      { code: '<SelectItem {...props} />', options: [selectConfig] },
      { code: '<Select.Item {...getItemProps()} />', options: [selectConfig] },
      { code: '<SelectItem value="a" {...rest} />', options: [selectConfig] },
      // dynamic ternary — not statically empty
      { code: '<SelectItem value={cond ? \'\' : \'x\'} />', options: [selectConfig] },
      // unrelated elements — not configured
      { code: '<div value="" />', options: [selectConfig] },
      { code: '<TabsTrigger>Tab</TabsTrigger>', options: [selectConfig] },
      // no config — rule is a no-op
      { code: '<SelectItem>No config</SelectItem>', options: [{ components: [] }] },
      // self-closing with value
      { code: '<SelectItem value="x" />', options: [selectConfig] },
      // other components in config, unrelated element still fine
      {
        code: '<SelectItem value="x" />',
        options: [{ components: [{ name: 'TabsTrigger', prop: 'value' }] }],
      },
    ],

    invalid: [
      // ── Missing value prop ───────────────────────────────────────────────
      {
        code: '<SelectItem>Apple</SelectItem>',
        options: [selectConfig],
        errors: [{ messageId: 'missingProp', data: { component: 'SelectItem', prop: 'value' } }],
      },
      {
        code: '<Select.Item>Apple</Select.Item>',
        options: [selectConfig],
        errors: [{ messageId: 'missingProp', data: { component: 'Select.Item', prop: 'value' } }],
      },
      // self-closing, no value
      {
        code: '<SelectItem />',
        options: [selectConfig],
        errors: [{ messageId: 'missingProp', data: { component: 'SelectItem', prop: 'value' } }],
      },
      {
        code: '<Select.Item />',
        options: [selectConfig],
        errors: [{ messageId: 'missingProp', data: { component: 'Select.Item', prop: 'value' } }],
      },
      // other props present but not value
      {
        code: '<SelectItem className="foo" disabled>Apple</SelectItem>',
        options: [selectConfig],
        errors: [{ messageId: 'missingProp', data: { component: 'SelectItem', prop: 'value' } }],
      },

      // ── Empty string value ───────────────────────────────────────────────
      // bare string attribute
      {
        code: '<SelectItem value="">Apple</SelectItem>',
        options: [selectConfig],
        errors: [{ messageId: 'emptyProp', data: { component: 'SelectItem', prop: 'value' } }],
      },
      {
        code: '<Select.Item value="">Apple</Select.Item>',
        options: [selectConfig],
        errors: [{ messageId: 'emptyProp', data: { component: 'Select.Item', prop: 'value' } }],
      },
      // expression container with empty string
      {
        code: '<SelectItem value={""}>Apple</SelectItem>',
        options: [selectConfig],
        errors: [{ messageId: 'emptyProp', data: { component: 'SelectItem', prop: 'value' } }],
      },
      {
        code: '<Select.Item value={""}>Apple</Select.Item>',
        options: [selectConfig],
        errors: [{ messageId: 'emptyProp', data: { component: 'Select.Item', prop: 'value' } }],
      },
      // empty template literal
      {
        code: '<SelectItem value={``}>Apple</SelectItem>',
        options: [selectConfig],
        errors: [{ messageId: 'emptyProp', data: { component: 'SelectItem', prop: 'value' } }],
      },

      // ── Multiple violations in same file ─────────────────────────────────
      {
        code: '<div><SelectItem /><Select.Item value="" /></div>',
        options: [selectConfig],
        errors: [
          { messageId: 'missingProp', data: { component: 'SelectItem', prop: 'value' } },
          { messageId: 'emptyProp', data: { component: 'Select.Item', prop: 'value' } },
        ],
      },

      // ── Works for any configured component ───────────────────────────────
      {
        code: '<TabsTrigger>Tab 1</TabsTrigger>',
        options: [{ components: [{ name: 'TabsTrigger', prop: 'value' }] }],
        errors: [{ messageId: 'missingProp', data: { component: 'TabsTrigger', prop: 'value' } }],
      },
      {
        code: '<RadioGroupItem value="" />',
        options: [{ components: [{ name: 'RadioGroupItem', prop: 'value' }] }],
        errors: [{ messageId: 'emptyProp', data: { component: 'RadioGroupItem', prop: 'value' } }],
      },
      {
        code: '<AccordionItem />',
        options: [{ components: [{ name: 'AccordionItem', prop: 'value' }] }],
        errors: [{ messageId: 'missingProp', data: { component: 'AccordionItem', prop: 'value' } }],
      },
    ],
  });
});
