# Prevent usage of browser globals in SSR contexts (`creatr/no-browser-globals-in-ssr`)

This rule prevents the usage of browser-specific global variables in contexts where they might be accessed during server-side rendering (SSR) in Next.js applications.

## Rule Details

During server-side rendering, browser-specific globals like `window`, `document`, `navigator`, `location`, and `localStorage` are not available. Attempting to access these globals during SSR will result in runtime errors. This rule helps catch these issues during development.

Examples of **incorrect** code for this rule:

```jsx
// ❌ Direct usage of window in component body
export default function Component() {
  const url = window.location.href;
  return <div>{url}</div>;
}

// ❌ Direct usage in JSX attributes
export default function Component() {
  return <a href={`${window.location.origin}/path`}>Link</a>;
}

// ❌ Direct usage of document
export default function Component() {
  document.title = 'New Title';
  return <div>Component</div>;
}

// ❌ Direct usage of localStorage
export default function Component() {
  const data = localStorage.getItem('key');
  return <div>{data}</div>;
}
```

Examples of **correct** code for this rule:

```jsx
// ✅ Using browser globals in useEffect
import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    console.log(window.location.href);
    document.title = 'New Title';
    localStorage.setItem('key', 'value');
  }, []);
  
  return <div>Component</div>;
}

// ✅ Using browser globals in event handlers
export default function Component() {
  return (
    <button onClick={() => window.location.href = '/new-page'}>
      Navigate
    </button>
  );
}

// ✅ Using browser globals with typeof check
export default function Component() {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('visited', 'true');
  }
  
  return <div>{url}</div>;
}
```

## Options

This rule accepts an options object with the following properties:

```js
{
  "creatr/no-browser-globals-in-ssr": ["error", {
    "allowInClientComponents": false,
    "allowInEffects": true,
    "allowInEventHandlers": true,
    "allowWithTypeCheck": true,
    "additionalGlobals": []
  }]
}
```

### `allowInClientComponents`

Default: `false`

When set to `true`, allows usage of browser globals in components marked with the `"use client"` directive.

### `allowInEffects`

Default: `true`

When set to `true`, allows usage of browser globals inside React effect hooks (`useEffect`, `useLayoutEffect`, `useInsertionEffect`).

### `allowInEventHandlers`

Default: `true`

When set to `true`, allows usage of browser globals inside event handler functions (e.g., `onClick`, `onChange`, etc.).

### `allowWithTypeCheck`

Default: `true`

When set to `true`, allows usage of browser globals when they are properly guarded with a `typeof` check to ensure they exist.

### `additionalGlobals`

Default: `[]`

An array of additional global variable names to check. This is useful for custom browser globals or third-party libraries that add global variables.

## When Not To Use It

If you're building a client-only application that doesn't use server-side rendering, you may want to disable this rule. However, for Next.js applications using the App Router or Pages Router with SSR, this rule is highly recommended to prevent runtime errors.

## Related Rules

- [`creatr/require-use-client`](./require-use-client.md) - Requires "use client" directive for components using client-side features