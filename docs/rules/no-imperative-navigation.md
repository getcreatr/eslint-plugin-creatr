# no-imperative-navigation

Require `<Link href>` for navigation instead of `router.push`, unless the case is provably imperative or carries a written reason.

## Rule Details

A `<Link>` renders a real `<a>`. That gives you prefetching, middle-click, cmd-click, right-click → "copy link address", "open in new tab", and keyboard activation — all for free. An `onClick` handler gives you none of them, and a `<div role="link" tabIndex={0}>` has to reimplement keyboard support by hand and usually gets it wrong.

**A dynamic href is not a reason to avoid `<Link>`.** `` <Link href={`/items/${id}`}> `` is the normal case. The question is whether the navigation is triggered by the user activating *this element*, or sequenced after something else finishes.

### ❌ Incorrect

```tsx
// A div reimplementing an anchor
<div role="link" tabIndex={0}
  onClick={() => router.push(getItemHref(item))}
  onKeyDown={(e) => { if (e.key === 'Enter') router.push(getItemHref(item)); }}
/>

// Row navigation baked into a shared table primitive
<tr onClick={() => { if (to) router.push(to); }} />

// A button that is really a link
<Button onClick={() => router.push('/settings')}>Settings</Button>

// Filter state via push, with no { scroll: false } and no url-state hook
function go(date) { router.push(`/arrivals?date=${date}`); }
```

### ✅ Correct

```tsx
<Link href={`/items/${item.id}`}>{item.name}</Link>

// Menu items and similar: most component libraries support asChild
<DropdownMenuItem asChild>
  <Link href={`/items/${item.id}`}>Open</Link>
</DropdownMenuItem>

// URL/filter state — auto-exempt
router.replace(`${pathname}?${qs}`, { scroll: false });

// Post-mutation redirect — auto-exempt. The id does not exist until the
// server answers, so there is no href to put in a Link.
useAction(create, { onSuccess: ({ data }) => router.push(`/items/${data.id}`) });

// Genuinely imperative, with the reason recorded
// link-reason: dnd-kit drag handle; a nested anchor swallows the drag gesture
router.push(href);
```

The annotation is greppable on purpose — `grep -rn "link-reason:"` returns every exception with its rationale.

### Exempt without any annotation

| Case | Why |
|---|---|
| A second argument containing `{ scroll: false }` | The URL-state write for filter/sort/page state. Measured across a generated app, this appears on every url-state call and on nothing else. |
| Inside an `onSuccess` / `onError` callback — object property **or** JSX prop | Post-mutation redirect, and auth/wizard transitions, which take the same shape. The target frequently does not exist until the action resolves. |
| Sequenced after an `await` in the same function | A link navigates on click; it cannot wait for an async step to resolve first. |
| `router.back()`, `.forward()`, `.refresh()` | No target URL, so there is nothing to put in an `href`. Never matched. |

## Options

```jsonc
{
  "creatr/no-imperative-navigation": ["error", {
    "marker": "link-reason:",   // comment prefix that silences the rule
    "minReasonLength": 20,      // reject stub reasons like "dynamic"
    "methods": ["push"],
    "ignorePaths": []
  }]
}
```

`methods` defaults to `["push"]`. `router.replace` is left alone because it is legitimate far more often — URL-state writes, modal dismissal, post-mutation redirects — so reporting it would lean hard on exemption-detection being correct. Widen to `["push", "replace"]` if you want to close the loophole where `push` is switched to `replace` to silence the rule.

There is deliberately **no autofix**. Converting to `<Link>` requires the enclosing element to become an anchor — often via `asChild`, sometimes by restructuring the markup — which the rule cannot see.

## When Not To Use It

If the project is not using the Next.js App Router, or navigation is genuinely all programmatic (a wizard, a kiosk flow with no addressable screens), turn the rule off rather than annotating every call site.
