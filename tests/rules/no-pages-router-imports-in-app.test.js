// tests/rules/no-pages-router-imports-in-app.test.js
import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-pages-router-imports-in-app.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-pages-router-imports-in-app rule', () => {
  ruleTester.run('no-pages-router-imports-in-app', rule, {
    valid: [
      // Import from next/router but file is NOT in app/ dir (pages dir)
      {
        code: `import { useRouter } from 'next/router';`,
        filename: '/project/pages/index.tsx',
      },
      // Import from next/router but file is NOT in app/ dir (components dir)
      {
        code: `import { useRouter } from 'next/router';`,
        filename: '/project/components/Nav.tsx',
      },
      // Import from next/navigation inside app/ (correct)
      {
        code: `import { useRouter } from 'next/navigation';`,
        filename: '/project/src/app/page.tsx',
      },
      // Import from next/link inside app/ (unrelated)
      {
        code: `import Link from 'next/link';`,
        filename: '/project/src/app/page.tsx',
      },
      // No imports at all inside app/
      {
        code: `export default function Page() { return <div>Hello</div>; }`,
        filename: '/project/app/page.tsx',
      },
      // File named app.tsx but NOT in /app/ directory — must NOT trigger
      {
        code: `import { useRouter } from 'next/router';`,
        filename: '/Users/project/src/components/app.tsx',
      },
      // my-app/ directory — not the /app/ router directory
      {
        code: `import { useRouter } from 'next/router';`,
        filename: '/Users/project/src/my-app/components/foo.tsx',
      },
    ],

    invalid: [
      // Named import in src/app/
      {
        code: `import { useRouter } from 'next/router';`,
        filename: '/project/src/app/page.tsx',
        errors: [{ messageId: 'useNavigationInstead' }],
      },
      // Multiple named imports in nested app/ dir — one error per ImportDeclaration
      {
        code: `import { useRouter, usePathname } from 'next/router';`,
        filename: '/project/src/app/dashboard/page.tsx',
        errors: [{ messageId: 'useNavigationInstead' }],
      },
      // Default import in app/
      {
        code: `import Router from 'next/router';`,
        filename: '/project/app/page.tsx',
        errors: [{ messageId: 'useNavigationInstead' }],
      },
      // Namespace import in app/
      {
        code: `import * as Router from 'next/router';`,
        filename: '/project/app/layout.tsx',
        errors: [{ messageId: 'useNavigationInstead' }],
      },
      // Re-export from next/router inside app/ — also wrong paradigm
      {
        code: `export { useRouter } from 'next/router';`,
        filename: '/project/src/app/utils.ts',
        errors: [{ messageId: 'useNavigationInstead' }],
      },
      {
        code: `export { useRouter, usePathname } from 'next/router';`,
        filename: '/project/src/app/layout.tsx',
        errors: [{ messageId: 'useNavigationInstead' }],
      },
    ],
  });
});
