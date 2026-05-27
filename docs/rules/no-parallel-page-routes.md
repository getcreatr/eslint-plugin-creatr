# no-parallel-page-routes

Disallow multiple Next.js App Router `page` files that resolve to the same URL path.

## Rule Details

In the Next.js App Router, route groups (`(name)`) are stripped when computing the final URL path. If two `page` files inside different route groups resolve to the same path, Next.js throws a runtime error:

> You cannot have two parallel pages that resolve to the same path.

This rule scans the `app/` directory at lint time and flags every conflicting `page` file.

### ❌ Incorrect

```
app/
  (marketing)/page.tsx   →  /   ❌ collision
  (auth)/page.tsx        →  /   ❌ collision
```

```
app/
  (admin)/[orgSlug]/page.tsx     →  /[orgSlug]   ❌ collision
  (employee)/[orgSlug]/page.tsx  →  /[orgSlug]   ❌ collision
```

### ✅ Correct

```
app/
  (marketing)/about/page.tsx   →  /about
  (marketing)/pricing/page.tsx →  /pricing
  dashboard/page.tsx           →  /dashboard
```

Route groups can be used freely as long as the resulting URL paths are unique.

## What is ignored

- **Private folders** (`_folder`) — excluded from the route tree entirely, never cause collisions
- **Non-page files** (`layout.tsx`, `loading.tsx`, `error.tsx`, etc.) — not checked

## Options

```js
// Optionally provide the absolute path to your app/ directory.
// If omitted, the rule infers it from each linted file's path.
'creatr/no-parallel-page-routes': ['error', {
  appDir: '/absolute/path/to/app'
}]
```

## When Not To Use It

If you are intentionally using parallel routes (`@slot` conventions) and understand the routing implications, you can disable this rule per-file. However, the error it catches is always a real Next.js runtime error — disabling is rarely correct.
