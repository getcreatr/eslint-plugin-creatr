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
        // Server component with viewport (no "use client")
        {
          code: `
export const viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function Page() {
  return <div>Page with viewport</div>
}`,
        },
        // Client component without metadata or viewport
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
        // Server component with re-exported metadata and viewport
        {
          code: `import { metadata, viewport } from './metadata';

export { metadata, viewport };

export default function Page() {
  return <div>About</div>
}`,
        },
      ],

      invalid: [
        // Client component with direct metadata export
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
        // Client component with direct viewport export
        {
          code: `"use client";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function Page() {
  return <div>Page with viewport</div>
}`,
          errors: [
            {
              messageId: 'noViewportInClient',
            },
          ],
        },
        // Client component with both metadata and viewport exports
        {
          code: `"use client";

export const metadata = {
  title: 'About Us',
  description: 'Learn about our company',
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function Page() {
  return <div>Page with both</div>
}`,
          errors: [
            {
              messageId: 'noMetadataInClient',
            },
            {
              messageId: 'noViewportInClient',
            },
          ],
        },
        // Client component with re-exported metadata
        {
          code: `"use client";

import { metadata, viewport } from './metadata';

export { metadata, viewport };

export default function Page() {
  return <div>About</div>
}`,
          errors: [
            {
              messageId: 'noMetadataInClient',
            },
            {
              messageId: 'noViewportInClient',
            },
          ],
        },
        // Re-export with renamed import
        {
          code: `"use client";

import { metadata as pageMeta, viewport } from './metadata';

export { pageMeta as metadata, viewport };

export default function Page() {
  return <div>About</div>
}`,
          errors: [
            {
              messageId: 'noMetadataInClient',
            },
            {
              messageId: 'noViewportInClient',
            },
          ],
        },
        // Re-export with renamed viewport
        {
          code: `"use client";

import { viewport as pageViewport } from './metadata';

export { pageViewport as viewport };

export default function Page() {
  return <div>Page</div>
}`,
          errors: [
            {
              messageId: 'noViewportInClient',
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
        // Example matching your current error
        {
          code: `'use client'

import "@/styles/globals.css";
import React from "react";

import { GeistSans } from "geist/font/sans";
import { UserProvider } from "@/components/user-context";
import { Toaster } from "react-hot-toast";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en" className={\`\${GeistSans.variable}\`}>
      <body>
        <UserProvider>
          {children}
          <Toaster position="top-right" />
        </UserProvider>
      </body>
    </html>
  );
}`,
          errors: [
            {
              messageId: 'noViewportInClient',
            },
          ],
        },
      ],
    });
  });
});