# no-hardcoded-redirect-urls

Disallow string literals passed to `redirect()` or `router.push()`/`router.replace()` that don't start with `/`.

## Rule Details

Relative paths passed to navigation functions are a common source of bugs — they resolve relative to the current URL rather than the site root, producing unexpected behavior that's hard to debug.

This rule requires all hardcoded URL strings to be either:
- **Absolute paths** starting with `/` — e.g. `'/dashboard'`
- **External URLs** starting with `http://` or `https://` — e.g. `'https://example.com'`

Dynamic values (variables, expressions) are not checked — only string and template literals.

### ❌ Incorrect

```ts
// Missing leading slash — resolves relative to current URL
redirect('dashboard')
redirect('settings/profile')

router.push('home')
router.replace('login')

// Template literal without leading slash
redirect(`dashboard/${id}`)
```

### ✅ Correct

```ts
// Absolute paths
redirect('/dashboard')
redirect('/settings/profile')

router.push('/home')
router.replace('/login')

// Template literals with leading slash
redirect(`/dashboard/${id}`)
router.push(`/users/${userId}/settings`)

// External URLs — intentional, not flagged
redirect('https://example.com')
router.push('https://auth.provider.com/login')

// Dynamic values — not checked
redirect(getRedirectUrl())
router.push(nextUrl)
```

## Options

No options.

## When Not To Use It

If you intentionally use relative redirects (uncommon in Next.js App Router), you can disable per-line:

```ts
// eslint-disable-next-line creatr/no-hardcoded-redirect-urls
redirect('relative/path')
```
