# no-metadata-in-client-components

Disallows exporting metadata from client components in Next.js App Router.

## Rule Details

In Next.js 15 App Router, components that use client-side features must be marked with the `"use client"` directive. However, metadata exports can only be used in Server Components. This rule catches the invalid pattern of having both in the same file.

Examples of **incorrect** code for this rule:

```javascript
"use client";

export const metadata = {
  title: 'Page Title',
  description: 'Page Description',
}

export default function Page() {
  return <div>Content</div>
}
