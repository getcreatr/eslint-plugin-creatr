import { test, describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-metadata-in-client-components.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-metadata-in-client-components rule', () => {
  test('basic cases', () => {
    ruleTester.run('no-metadata-in-client-components', rule, {
      valid: [
        // Server component with metadata (no "use client")
        {
          code: `import { Metadata } from 'next'

export const metadata = {
  title: 'About Us',
  description: 'Learn about our company',
}

export default function Page() {
  return <div>About</div>
}`,
        },
        // Client component without metadata
        {
          code: `"use client";

export default function ClientComponent() {
  return <div>Client Component</div>
}`,
        },
        // Regular exports from client component
        {
          code: `"use client";

export const someData = { foo: 'bar' };
export default function Component() {
  return <div>Component</div>
}`,
        },
        // No exports at all
        {
          code: `"use client";
import { useState } from 'react';

function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>
}`,
        },
      ],

      invalid: [
        // Client component with metadata export (without TypeScript)
        {
          code: `"use client";

import { Metadata } from 'next'

export const metadata = {
  title: 'About Us',
  description: 'Learn about our company',
}

export default function Page() {
  return <div>About</div>
}`,
          errors: [
            {
              messageId: 'noMetadataInClient',
            },
          ],
        },
        // Use client with single quotes
        {
          code: `'use client';

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch',
}

export default function Page() {
  return <div>Contact</div>
}`,
          errors: [
            {
              messageId: 'noMetadataInClient',
            },
          ],
        },
        // Full example from the error (without TypeScript)
        {
          code: `"use client";

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Metadata } from 'next'

export const metadata = {
  title: 'About Us | NaxterAI',
  description: 'Learn about NaxterAI, Sri Lanka\\'s leading AI solutions provider',
}

export default function AboutPage() {
  return <div>About</div>
}`,
          errors: [
            {
              messageId: 'noMetadataInClient',
            },
          ],
        },
      ],
    });
  });
});