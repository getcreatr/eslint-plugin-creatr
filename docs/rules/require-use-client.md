# Require "use client" directive when using client-side features (require-use-client)

This rule ensures that files using client-side features in Next.js App Router have the "use client" directive.

## Rule Details

This rule checks for:
- Imports from client-side libraries (framer-motion, react-spring, etc.)
- Usage of React hooks (useState, useEffect, etc.)
- Event handlers (onClick, onChange, etc.)

Examples of **incorrect** code for this rule:

```jsx
// Missing "use client" directive
import { motion } from 'framer-motion';

export default function Component() {
  return <motion.div />;
}
```

```jsx
// Missing "use client" with hooks
import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

Examples of **correct** code for this rule:

```jsx
"use client";

import { motion } from 'framer-motion';

export default function Component() {
  return <motion.div />;
}
```

```jsx
// Server component without client features
export default function ServerComponent({ data }) {
  return <div>{data.title}</div>;
}
```

## Options

```js
{
  "rules": {
    "creatr/require-use-client": ["error", {
      "libraries": ["custom-client-lib"],
      "hooks": ["useCustomHook"],
      "checkEventHandlers": true
    }]
  }
}
```

- `libraries` (array): Additional client-side libraries to check
- `hooks` (array): Additional hooks that require client-side rendering
- `checkEventHandlers` (boolean): Whether to check for event handlers (default: true)

## When Not To Use It

If you're not using Next.js App Router or you want to manually manage "use client" directives.

## Further Reading

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)