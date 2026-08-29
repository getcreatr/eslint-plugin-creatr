# no-server-components-in-client

Disallow importing and rendering server components inside client components.

## Rule Details

In Next.js App Router, every file is a server component by default. Client components (files with `"use client"`) **cannot** directly import and render server components — doing so causes a runtime error.

This rule flags any client component that imports a local file without `"use client"` and renders it as JSX.

### ❌ Incorrect

```tsx
// server-comp.tsx — no "use client"
export default function ServerComp() {
  return <div>{data}</div>;
}

// client-comp.tsx
'use client';
import ServerComp from './server-comp'; // ❌ ServerComp is a server component

export default function ClientComp() {
  return <ServerComp />; // flagged
}
```

### ✅ Correct

```tsx
// already-client.tsx
'use client';
export default function AlreadyClient() { ... }

// client-comp.tsx
'use client';
import AlreadyClient from './already-client'; // ✅ has "use client"

export default function ClientComp() {
  return <AlreadyClient />;
}
```

```tsx
// server-comp.tsx — no "use client"
export default function ServerComp() { ... }

// page.tsx — also a server component (no "use client")
import ServerComp from './server-comp'; // ✅ server importing server is fine

export default function Page() {
  return <ServerComp />;
}
```

```tsx
// client-comp.tsx
'use client';
import { formatDate } from './utils'; // ✅ not rendered as JSX

export default function ClientComp() {
  return <div>{formatDate(new Date())}</div>;
}
```

## Options

No options. The rule has no configuration.

## When Not To Use It

If you are intentionally using the [composition pattern](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#supported-pattern-passing-server-components-to-client-components-as-props) — passing server components as `children` or props — this rule won't flag that (the server component is rendered in the parent server component, not imported inside the client file).
