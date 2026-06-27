// tests/rules/require-server-action-metadata.test.js
import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/require-server-action-metadata.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('require-server-action-metadata rule', () => {
  ruleTester.run('require-server-action-metadata', rule, {
    valid: [
      // Has metadata (inline client).
      {
        code: `
import { action } from '@/lib/safe-action';
export const foo = action.metadata({ actionName: 'foo' }).action(fn);
`,
      },
      // Has metadata in a multi-method chain.
      {
        code: `
import { authedAction } from '@/lib/safe-action';
export const bar = authedAction.schema(s).metadata({ actionName: 'bar' }).action(fn);
`,
      },
      // `.action()` on a NON-safe-action object is ignored.
      {
        code: `
import { thing } from 'somewhere';
export const y = thing.action(fn);
`,
      },
      // A bare `.action()` with no tracked import is ignored.
      {
        code: `
export const z = whatever.foo().action(fn);
`,
      },
      // Derived (role-scoped) client that DOES have metadata.
      {
        code: `
import { authedAction } from '@/lib/safe-action';
const adminAction = authedAction.use(m);
export const baz = adminAction.metadata({ actionName: 'baz' }).action(fn);
`,
      },
    ],

    invalid: [
      // Missing metadata in a schema chain → inserted before `.action(`.
      {
        code: `
import { authedAction } from '@/lib/safe-action';
export const createX = authedAction.schema(s).action(fn);
`,
        output: `
import { authedAction } from '@/lib/safe-action';
export const createX = authedAction.schema(s).metadata({ actionName: 'createX' }).action(fn);
`,
        errors: [{ messageId: 'missingMetadata' }],
      },
      // Missing metadata on the bare client.
      {
        code: `
import { action } from '@/lib/safe-action';
export const foo = action.action(fn);
`,
        output: `
import { action } from '@/lib/safe-action';
export const foo = action.metadata({ actionName: 'foo' }).action(fn);
`,
        errors: [{ messageId: 'missingMetadata' }],
      },
      // Wrong actionName → corrected to the export name.
      {
        code: `
import { action } from '@/lib/safe-action';
export const foo = action.metadata({ actionName: 'bar' }).action(fn);
`,
        output: `
import { action } from '@/lib/safe-action';
export const foo = action.metadata({ actionName: 'foo' }).action(fn);
`,
        errors: [{ messageId: 'wrongActionName' }],
      },
      // Derived client missing metadata.
      {
        code: `
import { authedAction } from '@/lib/safe-action';
const adminAction = authedAction.use(m);
export const baz = adminAction.schema(s).action(fn);
`,
        output: `
import { authedAction } from '@/lib/safe-action';
const adminAction = authedAction.use(m);
export const baz = adminAction.schema(s).metadata({ actionName: 'baz' }).action(fn);
`,
        errors: [{ messageId: 'missingMetadata' }],
      },
    ],
  });
});
