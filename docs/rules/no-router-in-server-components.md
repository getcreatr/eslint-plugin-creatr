# no-router-in-server-components

Disallow client-only navigation hooks from `next/navigation` in files without `"use client"`.

## Rule Details

The following hooks from `next/navigation` are **client-only** — they rely on React context and cannot be called during server-side rendering:

- `useRouter`
- `usePathname`
- `useSearchParams`
- `useParams`

Using them in a Server Component (a file without `"use client"`) causes a runtime error. This rule flags the import itself, before the hook is even called.

Note: Other exports from `next/navigation` like `redirect`, `notFound`, and `revalidatePath` work on the server and are not flagged.

### ❌ Incorrect

```tsx
// No "use client" — this is a server component
import { useRouter } from 'next/navigation'  // ❌

export default function Page() {
  const router = useRouter()  // runtime error
  // ...
}
```

```tsx
import { usePathname, useSearchParams } from 'next/navigation'  // ❌ both flagged
```

### ✅ Correct

```tsx
'use client'  // ✅ marks this as a client component

import { useRouter, usePathname } from 'next/navigation'

export default function Nav() {
  const router = useRouter()
  const pathname = usePathname()
  // ...
}
```

```tsx
// Server component — using server-safe exports only
import { redirect, notFound } from 'next/navigation'  // ✅ not flagged

export default async function Page({ params }) {
  const data = await fetch('/api/data')
  if (!data.ok) notFound()
  redirect('/error')
}
```

## Options

No options.

## When Not To Use It

This rule has no false positives — client-only hooks in a server component always fail at runtime.
