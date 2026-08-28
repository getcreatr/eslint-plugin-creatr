# no-raw-img-element

Require `next/image` instead of a raw `<img>`, unless the case is provably unoptimisable or carries a written reason.

## Rule Details

`next/image` converts to WebP/AVIF, generates responsive sizes per device, lazy-loads below the fold, and reserves space so the layout does not shift while loading. A raw `<img>` does none of it: it ships the original bytes at full size to every device and is a common source of both poor LCP and cumulative layout shift.

Next.js ships its own `@next/next/no-img-element`, but it has no options and no exemptions beyond `<picture>` children and metadata routes. It cannot tell an unoptimisable SVG from an unoptimised hero, so the first legitimate `<img>` forces a project to disable the whole rule — which is exactly what tends to happen. This rule exists to make the legitimate cases silent, so the rule can stay on.

**A dynamic `src` is not a reason to avoid `<Image>`.** An avatar in a fixed-size container is a `fill` + `sizes` case whether the URL comes from a literal or from `user.image`. The question is whether the element sits in a determinate box, not where the URL came from.

### ❌ Incorrect

```tsx
// Static asset — should be <Image> with width/height, plus priority above the fold
<img src="/images/landing/hero.jpg" alt="" className="h-full w-full object-cover" />

// Dynamic src in a determinate box — should be <Image fill sizes="...">
<div className="relative h-[240px]">
  <img src={doctor.avatarUrl} alt={doctor.name} className="h-full w-full object-cover" />
</div>

// A marker with no actual reason
{/* img-reason: dynamic */}
<img src={url} alt="" />
```

### ✅ Correct

```tsx
// Known intrinsic size
<Image src="/logo.jpg" alt="" width={96} height={96} priority />

// Determinate box, unknown intrinsic size — the canonical avatar shape
<div className="relative h-16 w-16 overflow-hidden rounded-full">
  <Image src={doctor.avatarUrl} alt={doctor.name} fill sizes="64px" className="object-cover" />
</div>

// SVG — already a vector, optimisation has nothing to do. No annotation needed.
<img src="/icons/leaf.svg" alt="" />

// Local preview before upload — there is no URL for the optimiser to fetch
<img src={objectUrl} alt="" />          {/* when src is a literal data:/blob: */}

// Genuinely unmeasurable, with the reason recorded
{/* img-reason: arbitrary uploaded document in a viewer; no determinate box to give fill */}
<img src={src} alt={fileName} />
```

The annotation is greppable on purpose — `grep -rn "img-reason:"` returns every exception in the codebase together with its rationale.

### Exempt without any annotation

| Case | Why |
|---|---|
| `src` is a string ending `.svg` | Already a vector; the optimiser is a no-op |
| `src` is a literal `data:` or `blob:` URI | No fetchable URL; `next/image` cannot process one |
| The element is a child of `<picture>` | `<picture>` owns art direction and requires an `<img>` fallback |
| The file is `opengraph-image.*`, `twitter-image.*`, `icon.*`, `apple-icon.*` | Next renders these to an image; `<Image>` cannot run there |
| The path matches `ignorePaths` (default `src/emails/`) | Mail clients cannot execute `next/image`; use `@react-email`'s `<Img>` |
| There is no `src` attribute — e.g. `<img {...props} />` | Nothing to judge; the caller is the real site |

## Options

```jsonc
{
  "creatr/no-raw-img-element": ["error", {
    "marker": "img-reason:",        // comment prefix that silences the rule
    "minReasonLength": 20,          // reject stub reasons like "dynamic"
    "allowSvg": true,               // exempt .svg sources
    "allowDataUri": true,           // exempt literal data:/blob: sources
    "ignorePaths": ["src/emails/"]  // replaced wholesale, not merged
  }]
}
```

`ignorePaths` replaces the default rather than extending it — include `src/emails/` explicitly if you add your own entries.

There is deliberately **no autofix**. The correct replacement needs either `fill` + `sizes` or `width` + `height`, chosen from the parent's layout, which the rule cannot see. A wrong autofix here breaks the page silently.

## When Not To Use It

If the project is a static export (`output: 'export'`) with no custom image loader, `next/image` optimisation is unavailable and every `<img>` would need an annotation. Turn the rule off rather than annotating every call site.
