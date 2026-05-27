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
        code: `'use client'; import { useRouter } from 'next/navigation'`,
      },
      // Has "use client" — multiple hooks are OK
      {
        code: `'use client'; import { usePathname, useSearchParams } from 'next/navigation'`,
      },
      // Server-safe hook, no "use client" needed
      {
        code: `import { redirect } from 'next/navigation'`,
      },
      // Server-safe hook, no "use client" needed
      {
        code: `import { notFound } from 'next/navigation'`,
      },
      // Not from next/navigation
      {
        code: `import { useRouter } from 'some-other-pkg'`,
      },
      // All server-safe
      {
        code: `import { revalidatePath, redirect } from 'next/navigation'`,
      },
    ],

    invalid: [
      // No "use client" — useRouter flagged
      {
        code: `import { useRouter } from 'next/navigation'`,
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useRouter' },
          },
        ],
      },
      // No "use client" — usePathname flagged
      {
        code: `import { usePathname } from 'next/navigation'`,
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'usePathname' },
          },
        ],
      },
      // No "use client" — useSearchParams flagged
      {
        code: `import { useSearchParams } from 'next/navigation'`,
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useSearchParams' },
          },
        ],
      },
      // No "use client" — useParams flagged
      {
        code: `import { useParams } from 'next/navigation'`,
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useParams' },
          },
        ],
      },
      // Two hooks — two errors
      {
        code: `import { useRouter, usePathname } from 'next/navigation'`,
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
        code: `import { redirect, useRouter } from 'next/navigation'`,
        errors: [
          {
            messageId: 'hookRequiresClient',
            data: { hook: 'useRouter' },
          },
        ],
      },
    ],
  });
});
