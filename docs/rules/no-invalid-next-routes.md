# no-invalid-next-routes

Disallow navigation to routes that have no corresponding `page.tsx` in the Next.js App Router `app/` directory.

## Rule Details

In Next.js App Router, a URL only works if a `page.tsx` (or `page.ts`) exists at the corresponding path inside the `app/` directory. This rule scans that directory at lint time and flags any navigation call whose path does not resolve to an existing page.

When a route is invalid, the error message lists the closest matching routes that **do** exist so that AI tools and developers can immediately see the correct path to use.

### What is checked

| Pattern | Example |
|---|---|
| `<Link href="...">` | JSX, static string or template literal |
| `router.push(...)` | from `useRouter()` — variable must be named `router` |
| `router.replace(...)` | from `useRouter()` — variable must be named `router` |
| `redirect(...)` | any call named `redirect` (typically from `next/navigation`) |
| `window.location.href = ...` | direct assignment |

### ❌ Incorrect

```tsx
// /tenants/[id] has no page.tsx — only sub-routes exist under it
<Link href="/tenants/abc">View tenant</Link>
router.push("/tenants/abc")
redirect("/tenants/abc")

// Completely non-existent route
<Link href="/admin/nonexistent">Settings</Link>
router.push("/nowhere")

// Template literal with a known-bad static structure
<Link href={`/tenants/${id}/badroute`}>Go</Link>
router.push(`/tenants/${id}`)       // /tenants/[id] has no page.tsx
redirect(`/tenants/${id}/missing`)
```

ESLint error output (with suggestions):

```
Route "/tenants/abc" does not exist — no page.tsx was found at this path in the
app directory. The following routes exist under this path — did you mean one of
these? /tenants/[id]/onboarding, /tenants/[id]/onboarding/[task_id],
/tenants/[id]/assets, /tenants/[id]/dashboard
```

### ✅ Correct

```tsx
// Routes that have a page.tsx
<Link href="/tenants">All tenants</Link>
<Link href="/tenants/abc/onboarding">Onboarding</Link>
<Link href="/tenants/abc/onboarding/task-1">Task detail</Link>
router.push("/login")
redirect("/tenants/abc/dashboard")

// Template literals whose static prefix matches a valid route structure
<Link href={`/tenants/${id}/onboarding`}>Go</Link>
<Link href={`/tenants/${id}/onboarding/${taskId}`}>Task</Link>
router.push(`/tenants/${id}/assets`)

// Paths with query strings or hashes — stripped before matching
<Link href="/login?redirect=/dashboard">Login</Link>
router.push("/tenants?page=2")

// External URLs — not checked
router.push("https://example.com")
<Link href="http://external.com">External</Link>
```

## Known Limitation — Dynamic Base Paths

Template literals that **start** with a runtime variable cannot be checked:

```tsx
// basePath is a prop — its value is unknown at lint time
<Link href={`${basePath}/${task.id}`}>View</Link>

// prefix is a variable — the full path cannot be determined
router.push(`${prefix}/dashboard`)
```

These are **silently skipped** (no false positive). The rule can only validate paths where the static part of the template starts with `/`.

### The `onboarding-queue.tsx` case

The link below was the original motivation for this rule:

```tsx
// onboarding-queue.tsx
<Link href={`${basePath}/${task.id}`}>View</Link>
```

The template starts with `${basePath}` — a prop variable — so the rule cannot inspect it. The bug (wrong `basePath` value passed from the parent page) requires inter-component data-flow analysis to catch, which is beyond the scope of a static AST rule.

The rule **does** catch this class of bug at the call site when the route is written directly:

```tsx
// ❌ Caught — static string pointing at a non-existent route
<Link href={`/tenants/${id}`}>View</Link>

// ✅ Not caught (correct) — static string pointing at a valid route
<Link href={`/tenants/${id}/onboarding/${taskId}`}>View</Link>
```

To protect against the dynamic-basePath pattern, ensure the component's `basePath` prop is always passed a template literal whose static structure is validated elsewhere, or document the expected format in a TypeScript branded type.

## Options

```ts
'creatr/no-invalid-next-routes': ['error', {
  appDir: 'src/app',  // path to the Next.js app directory, relative to CWD
}]
```

| Option | Type | Default | Description |
|---|---|---|---|
| `appDir` | `string` | `'src/app'` | Path to the `app/` directory relative to the project root. |

## How route matching works

The rule scans the `app/` directory at lint startup and builds a list of route patterns. Each pattern is derived from the filesystem path to a `page.tsx`:

| Filesystem path | URL route pattern |
|---|---|
| `app/page.tsx` | `/` |
| `app/(auth)/login/page.tsx` | `/login` (route group stripped) |
| `app/(operational)/tenants/[id]/onboarding/page.tsx` | `/tenants/[id]/onboarding` |
| `app/(operational)/tenants/[id]/assets/[...all]/page.tsx` | `/tenants/[id]/assets/**` (catch-all) |

A navigation call's path is split into segments and matched against this list. Dynamic segments (`[id]`) match any single segment; catch-alls (`[...slug]`) match any number of remaining segments.

## When Not To Use It

- If your project uses a non-standard `app/` directory location, configure `appDir` to match.
- If you generate routes dynamically at build time (e.g. a CMS-driven slug), those routes will appear missing. Disable per-line with `// eslint-disable-next-line creatr/no-invalid-next-routes`.
