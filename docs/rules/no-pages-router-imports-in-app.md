# no-pages-router-imports-in-app

Disallow imports from `next/router` (Pages Router) inside the App Router (`app/` directory).

## Rule Details

`next/router` is the Pages Router navigation API. It does not work inside the Next.js App Router. The correct package is `next/navigation`.

This rule flags any `import ... from 'next/router'` in a file whose path contains `/app/`.

### ❌ Incorrect

```tsx
// app/dashboard/page.tsx
import { useRouter } from 'next/router'  // ❌

export default function Page() {
  const router = useRouter()
  // ...
}
```

```tsx
// src/app/settings/page.tsx
import Router from 'next/router'  // ❌
```

### ✅ Correct

```tsx
// app/dashboard/page.tsx
import { useRouter } from 'next/navigation'  // ✅

export default function Page() {
  const router = useRouter()
  router.push('/home')
}
```

## API differences

| Pages Router (`next/router`) | App Router (`next/navigation`) |
|------------------------------|-------------------------------|
| `useRouter()` | `useRouter()` |
| `router.push()` | `router.push()` |
| `router.pathname` | `usePathname()` |
| `router.query` | `useSearchParams()`, `useParams()` |
| `router.events` | No equivalent |

## Options

No options.

## When Not To Use It

If your project mixes Pages Router and App Router and you have files inside `app/` that genuinely need the Pages Router API (unusual), you can disable per-file. This is almost always a mistake.
