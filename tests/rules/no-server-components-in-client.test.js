// tests/rules/no-server-components-in-client.test.js
import { describe, beforeEach, afterAll } from 'bun:test';
import { RuleTester } from 'eslint';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rule from '../../lib/rules/no-server-components-in-client.js';

// The rule reads imported files from disk to check their server/client status.
// We create real temp files for each fixture scenario.

const tmpRoots = [];

function makeFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creatr-server-in-client-'));
  tmpRoots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  rule._resetCache();
  return root;
}

afterAll(() => {
  for (const root of tmpRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

// True server components — have explicit server-only signals

const ASYNC_SERVER_COMP = `import { db } from '@/db';
export default async function ServerComp() {
  const data = await db.query('SELECT 1');
  return <div>{data}</div>;
}`;

const SERVER_ONLY_IMPORT_COMP = `import 'server-only';
export default function SecretComp() {
  return <div>secrets</div>;
}`;

const NEXT_HEADERS_COMP = `import { cookies } from 'next/headers';
export default function CookieComp() {
  const store = cookies();
  return <div>{store.get('session')?.value}</div>;
}`;

// Named async export
const NAMED_ASYNC_SERVER = `import { db } from '@/db';
export async function NamedServer() {
  const rows = await db.query('SELECT 1');
  return <ul>{rows.map(r => <li key={r.id}>{r.name}</li>)}</ul>;
}`;

// A client component (has "use client")
const CLIENT_COMP = `'use client';
export default function ClientComp() {
  return <div>client</div>;
}`;

// A pure presentational component — no "use client", no server-only signals
// (e.g. shadcn Card, Button). Should NOT be flagged.
const PRESENTATIONAL = `import * as React from 'react';
export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
));
Card.displayName = 'Card';`;

// A utility file — no JSX, no "use client"
const UTIL = `export function formatDate(d) { return d.toISOString(); }`;

const root = makeFixture({
  'src/components/AsyncServerComp.tsx': ASYNC_SERVER_COMP,
  'src/components/ServerOnlyComp.tsx': SERVER_ONLY_IMPORT_COMP,
  'src/components/NextHeadersComp.tsx': NEXT_HEADERS_COMP,
  'src/components/NamedServer.tsx': NAMED_ASYNC_SERVER,
  'src/components/ClientComp.tsx': CLIENT_COMP,
  'src/components/ui/card.tsx': PRESENTATIONAL,
  'src/lib/utils.ts': UTIL,
  'src/features/dashboard/Widget.tsx': ASYNC_SERVER_COMP,
});

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

// Filename for the "current" client file under test
const clientFile = path.join(root, 'src/app/page.tsx');

describe('no-server-components-in-client rule', () => {
  beforeEach(() => {
    rule._resetCache();
  });

  ruleTester.run('no-server-components-in-client', rule, {
    valid: [
      // ── Not a client component — no "use client" in current file ──────────
      {
        code: `import AsyncServerComp from '../components/AsyncServerComp';
export default function Page() {
  return <AsyncServerComp />;
}`,
        filename: clientFile,
      },

      // ── Importing a client component (has "use client") ───────────────────
      {
        code: `'use client';
import ClientComp from '../components/ClientComp';
export default function Page() {
  return <ClientComp />;
}`,
        filename: clientFile,
      },

      // ── Importing from node_modules — never flagged ───────────────────────
      {
        code: `'use client';
import { useState } from 'react';
import Image from 'next/image';
export default function Page() {
  return <Image src="/img.png" alt="" width={100} height={100} />;
}`,
        filename: clientFile,
      },

      // ── Pure presentational component (no "use client", no server signals)
      //    e.g. shadcn Card — safe to use in client components ───────────────
      {
        code: `'use client';
import { Card } from '../components/ui/card';
export default function Page() {
  return <Card>hello</Card>;
}`,
        filename: clientFile,
      },

      // ── Utility import, not rendered as JSX ───────────────────────────────
      {
        code: `'use client';
import { formatDate } from '../lib/utils';
export default function Page() {
  return <div>{formatDate(new Date())}</div>;
}`,
        filename: clientFile,
      },

      // ── Import declared but never used in JSX ─────────────────────────────
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
export default function Page() {
  return <div>hello</div>;
}`,
        filename: clientFile,
      },

      // ── Server component used as a function call, not JSX ─────────────────
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
const el = AsyncServerComp({ children: null });
export default function Page() { return <div />; }`,
        filename: clientFile,
      },

      // ── Server component passed as a prop value, not rendered as JSX ───────
      // AsyncServerComp is in localServerImports but never appears as a
      // JSXOpeningElement name — the rule's JSXOpeningElement visitor only
      // checks node.name, not attribute values.
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
function Wrapper({ component: Comp }) { return null; }
export default function Page() {
  return <Wrapper component={AsyncServerComp} />;
}`,
        filename: clientFile,
      },
    ],

    invalid: [
      // ── Async server component rendered as JSX ────────────────────────────
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
export default function Page() {
  return <AsyncServerComp />;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Component that imports 'server-only' ─────────────────────────────
      {
        code: `'use client';
import ServerOnlyComp from '../components/ServerOnlyComp';
export default function Page() {
  return <ServerOnlyComp />;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Component using next/headers ──────────────────────────────────────
      {
        code: `'use client';
import NextHeadersComp from '../components/NextHeadersComp';
export default function Page() {
  return <NextHeadersComp />;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Named async server component rendered as JSX ──────────────────────
      {
        code: `'use client';
import { NamedServer } from '../components/NamedServer';
export default function Page() {
  return <NamedServer />;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Multiple server components in same file ───────────────────────────
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
import ServerOnlyComp from '../components/ServerOnlyComp';
export default function Page() {
  return (
    <div>
      <AsyncServerComp />
      <ServerOnlyComp />
    </div>
  );
}`,
        filename: clientFile,
        errors: [
          { messageId: 'serverComponentInClient' },
          { messageId: 'serverComponentInClient' },
        ],
      },

      // ── Deeper relative path to async server component ────────────────────
      {
        code: `'use client';
import Widget from '../features/dashboard/Widget';
export default function Page() {
  return <Widget />;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Conditional (&&) JSX renders server component ─────────────────────
      // The JSXOpeningElement visitor fires regardless of whether the element
      // is inside a logical expression.
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
export default function Page({ isLoading }) {
  return <div>{isLoading && <AsyncServerComp />}</div>;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Ternary JSX renders server component ─────────────────────────────
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
export default function Page({ condition }) {
  return <div>{condition ? <AsyncServerComp /> : null}</div>;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },

      // ── Map callback renders server component ─────────────────────────────
      {
        code: `'use client';
import AsyncServerComp from '../components/AsyncServerComp';
export default function Page({ items }) {
  return <ul>{items.map(i => <AsyncServerComp key={i} />)}</ul>;
}`,
        filename: clientFile,
        errors: [{ messageId: 'serverComponentInClient' }],
      },
    ],
  });
});
