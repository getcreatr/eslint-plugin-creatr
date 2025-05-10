# no-event-handlers-in-server-components

Disallow event handlers in server components (components without "use client").

## Rule Details

This rule prevents the use of event handlers (like `onClick`, `onChange`, etc.) in server components. In Next.js 13+ with the app router, components are server components by default and cannot have interactive event handlers since they run on the server.

## Why is this rule important?

Server components in Next.js are rendered on the server and sent to the client as HTML. They cannot have interactive JavaScript event handlers because:

1. Server components don't have access to the browser environment
2. Event handlers require client-side JavaScript execution
3. Attempting to use event handlers in server components will cause runtime errors during build

## Examples

Examples of **incorrect** code for this rule:

```jsx
// ❌ Missing "use client" directive but using onClick
export default function Button() {
  return <button onClick={() => console.log('clicked')}>Click me</button>
}

// ❌ Event handler in server component
export default function Form() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <input onChange={(e) => console.log(e.target.value)} />
    </form>
  )
}

// ❌ Using window.history in server component
export default function NotFound() {
  return (
    <div>
      <button onClick={() => window.history.back()}>
        Go Back
      </button>
    </div>
  )
}

// ❌ Multiple event handlers in server component
export default function InteractiveCard() {
  const handleClick = () => console.log('clicked');
  
  return (
    <div 
      onMouseOver={() => console.log('hover')}
      onClick={handleClick}
    >
      <input onFocus={() => console.log('focused')} />
    </div>
  )
}
```

Examples of **correct** code for this rule:

```jsx
// ✅ Client component with event handlers
"use client";

export default function Button() {
  return <button onClick={() => console.log('clicked')}>Click me</button>
}

// ✅ Server component without event handlers
export default function Card({ title, content }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{content}</p>
    </div>
  )
}

// ✅ Server component with Link (navigation without JS)
import Link from "next/link";

export default function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
    </nav>
  )
}

// ✅ Splitting interactive parts into client components
import InteractiveButton from './InteractiveButton'; // This has "use client"

export default function ServerPage() {
  return (
    <div>
      <h1>Static content in server component</h1>
      <InteractiveButton />
    </div>
  )
}
```

## Options

This rule accepts an options object with the following properties:

### `allowedEventHandlers`

An array of event handler names that should be allowed in server components. This can be useful for non-interactive event handlers.

Default: `[]`

Example:
```json
{
  "rules": {
    "creatr/no-event-handlers-in-server-components": ["error", {
      "allowedEventHandlers": ["onLoad", "onError"]
    }]
  }
}
```

### `checkCustomComponents`

Whether to check event handlers on custom components (components that start with an uppercase letter).

Default: `true`

Example:
```json
{
  "rules": {
    "creatr/no-event-handlers-in-server-components": ["error", {
      "checkCustomComponents": false
    }]
  }
}
```

With this option set to `false`, the following would be allowed:
```jsx
// This would not trigger an error when checkCustomComponents is false
export default function Page() {
  return <CustomButton onClick={() => console.log('clicked')} />
}
```

## Known Limitations

This rule uses static analysis and cannot detect event handlers passed through dynamic patterns such as:

1. **Spread props**:
   ```jsx
   const props = { onClick: () => {} };
   return <button {...props}>Button</button>
   ```

2. **Computed property names**:
   ```jsx
   const handlerName = 'onClick';
   return <button {...{ [handlerName]: () => {} }}>Button</button>
   ```

3. **Props from functions**:
   ```jsx
   const getProps = () => ({ onClick: () => {} });
   return <button {...getProps()}>Button</button>
   ```

These patterns require runtime analysis which is beyond the scope of ESLint's static analysis capabilities.

## When Not To Use It

You should not use this rule if:

1. You're not using Next.js with the app router
2. You're using a different framework that doesn't have the concept of server components
3. You don't want to enforce the separation between server and client components
4. You're in a migration phase and haven't yet separated your components

## Related Rules

- [require-use-client](./require-use-client.md) - Requires "use client" directive for components using client-side features
- [no-browser-globals-in-ssr](./no-browser-globals-in-ssr.md) - Prevents usage of browser globals in server-side code

## Further Reading

- [Next.js Client Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Next.js Server Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Using Client Components in Next.js](https://nextjs.org/docs/app/building-your-application/rendering/client-components#using-client-components-in-nextjs)