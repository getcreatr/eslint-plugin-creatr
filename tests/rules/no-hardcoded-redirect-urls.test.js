// tests/rules/no-hardcoded-redirect-urls.test.js
import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-hardcoded-redirect-urls.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-hardcoded-redirect-urls rule', () => {
  ruleTester.run('no-hardcoded-redirect-urls', rule, {
    valid: [
      // redirect with absolute path
      { code: `redirect('/dashboard')` },
      // redirect with absolute path and query string
      { code: `redirect('/dashboard?tab=1')` },
      // router.push with absolute path
      { code: `router.push('/settings')` },
      // router.replace with absolute path
      { code: `router.replace('/home')` },
      // redirect with a variable (not a string literal)
      { code: `redirect(someVar)` },
      // template literal starting with /
      { code: 'redirect(`/dashboard/${id}`)' },
      // just a slash
      { code: `redirect('/')` },
      // some other function — not redirect or router.push
      { code: `someOtherFn('dashboard')` },
      // external URLs are intentional and must NOT be flagged
      { code: `redirect('https://example.com')` },
      { code: `redirect('http://example.com')` },
      { code: `router.push('https://example.com/path')` },
    ],

    invalid: [
      // redirect with relative path
      {
        code: `redirect('dashboard')`,
        errors: [
          {
            messageId: 'relativeRedirect',
            data: { value: 'dashboard' },
          },
        ],
      },
      // router.push with relative path
      {
        code: `router.push('settings')`,
        errors: [
          {
            messageId: 'relativeRouterPush',
            data: { method: 'push', value: 'settings' },
          },
        ],
      },
      // router.replace with relative path
      {
        code: `router.replace('home')`,
        errors: [
          {
            messageId: 'relativeRouterPush',
            data: { method: 'replace', value: 'home' },
          },
        ],
      },
      // template literal not starting with /
      {
        code: 'redirect(`dashboard/${id}`)',
        errors: [
          {
            messageId: 'relativeRedirect',
            data: { value: 'dashboard/...' },
          },
        ],
      },
    ],
  });
});
