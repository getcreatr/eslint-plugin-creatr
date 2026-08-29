import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-router-in-server-components.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-router-in-server-components rule', () => {
  ruleTester.run('no-router-in-server-components', rule, {
    valid: [
      // Has "use client" — useRouter is OK
      {
        code: '\'use client\'; import { useRouter } from \'next/navigation\'',
      },
      // Has "use client" — multiple hooks are OK
      {
        code: '\'use client\'; import { usePathname, useSearchParams } from \'next/navigation\'',
      },
      // Server-safe hook, no "use client" needed
      {
        code: 'import { redirect } from \'next/navigation\'',
      },
      // Server-safe hook, no "use client" needed
      {
        code: 'import { notFound } from \'next/navigation\'',
      },
      // Not from next/navigation
      {
        code: 'import { useRouter } from \'some-other-pkg\'',
      },
      // All server-safe
      {
        code: 'import { revalidatePath, redirect } from \'next/navigation\'',
      },
      // All server-safe hooks in one import
      {
        code: 'import { redirect, notFound, permanentRedirect, revalidatePath } from \'next/navigation\'',
      },
      // hook from a different package is fine
      {
        code: 'import { useRouter } from \'some-other-package\'',
      },
      // type import — must NOT be flagged (requires TypeScript parser)
      {
        code: 'import type { useRouter } from \'next/navigation\'',
        parser: require.resolve('@typescript-eslint/parser'),
      },
      {
        code: 'import type { usePathname, useSearchParams } from \'next/navigation\'',
        parser: require.resolve('@typescript-eslint/parser'),
      },
    ],

    invalid: [
      // No "use client" — useRouter flagged
      {
        code: 'import { useRouter } from \'next/navigation\'',
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useRouter' },
          },
        ],
      },
      // No "use client" — usePathname flagged
      {
        code: 'import { usePathname } from \'next/navigation\'',
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'usePathname' },
          },
        ],
      },
      // No "use client" — useSearchParams flagged
      {
        code: 'import { useSearchParams } from \'next/navigation\'',
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useSearchParams' },
          },
        ],
      },
      // No "use client" — useParams flagged
      {
        code: 'import { useParams } from \'next/navigation\'',
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useParams' },
          },
        ],
      },
      // Two hooks — two errors
      {
        code: 'import { useRouter, usePathname } from \'next/navigation\'',
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useRouter' },
          },
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'usePathname' },
          },
        ],
      },
      // Mixed: server-safe + hook — only hook flagged
      {
        code: 'import { redirect, useRouter } from \'next/navigation\'',
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useRouter' },
          },
        ],
      },
      // comment 'use client' does not count — not a directive
      {
        code: `// 'use client'
import { useRouter } from 'next/navigation'`,
        errors: [{ messageId: 'hookRequiresClient', data: { hook: 'useRouter' } }],
      },
      // file with 'use server' directive (explicit server component)
      {
        code: `'use server';
import { useRouter } from 'next/navigation'`,
        errors: [{ messageId: 'hookRequiresClient', data: { hook: 'useRouter' } }],
      },
      // mixed import — only useRouter is flagged, redirect is not
      {
        code: 'import { useRouter, redirect } from \'next/navigation\'',
        errors: [{ messageId: 'hookRequiresClient', data: { hook: 'useRouter' } }],
      },
    ],
  });
});
