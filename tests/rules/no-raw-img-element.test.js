import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-raw-img-element.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

const APP = '/repo/src/features/x/components/thing.tsx';

describe('no-raw-img-element rule', () => {
  ruleTester.run('no-raw-img-element', rule, {
    valid: [
      // ── Auto-exempt: SVG ────────────────────────────────────────────────
      // Real: verified-docs landing-page-client.tsx:333
      {
        filename: APP,
        code: 'const A = () => <img src="/images/landing/leaf.svg" alt="" />;',
      },
      // Real: logo-cloud.tsx:15 — external SVG, present in BOTH audited repos
      {
        filename: APP,
        code: 'const A = () => <img src="https://html.tailus.io/blocks/customers/nvidia.svg" alt="Nvidia" height="20" width="auto" />;',
      },
      // Extension test must survive a query string / hash
      {
        filename: APP,
        code: 'const A = () => <img src="/logo.svg?v=2" alt="" />;',
      },
      {
        filename: APP,
        code: 'const A = () => <img src="/logo.SVG" alt="" />;',
      },

      // ── Auto-exempt: inline URIs ────────────────────────────────────────
      {
        filename: APP,
        code: 'const A = () => <img src="data:image/png;base64,iVBORw0KGgo=" alt="" />;',
      },
      {
        filename: APP,
        code: 'const A = () => <img src="blob:https://x/9f2c" alt="" />;',
      },
      // Single-quasi template literal is still statically knowable
      {
        filename: APP,
        code: 'const A = () => <img src={`/icon.svg`} alt="" />;',
      },

      // ── Auto-exempt: structural ─────────────────────────────────────────
      {
        filename: APP,
        code: `const A = () => (
          <picture>
            <source srcSet="/hero.avif" type="image/avif" />
            <img src="/hero.jpg" alt="" />
          </picture>
        );`,
      },
      // Real: stories.tsx:136 — spread props, no src node to judge
      {
        filename: APP,
        code: 'const A = (props) => <img {...props} />;',
      },

      // ── Auto-exempt: whole-file ─────────────────────────────────────────
      {
        filename: '/repo/src/app/opengraph-image.tsx',
        code: 'const A = () => <img src="/og.png" alt="" />;',
      },
      {
        filename: '/repo/src/app/blog/[slug]/twitter-image.tsx',
        code: 'const A = () => <img src="/t.png" alt="" />;',
      },
      {
        filename: '/repo/src/app/icon.tsx',
        code: 'const A = () => <img src="/i.png" alt="" />;',
      },
      // Email templates: next/image cannot run in a mail client
      {
        filename: '/repo/src/emails/EmailInvoice.tsx',
        code: 'const A = () => <img src="/logo.png" alt="" />;',
      },
      // Windows path separators must normalise
      {
        filename: 'C:\\repo\\src\\emails\\Welcome.tsx',
        code: 'const A = () => <img src="/logo.png" alt="" />;',
      },

      // ── Silenced by a reason comment ────────────────────────────────────
      // Real: document-preview-dialog.tsx:59-61 — the one hand-written
      // justification found in either repo, reworded to the marker form.
      {
        filename: APP,
        code: `const A = ({ src }) => (
          <div>
            {/* img-reason: bytes come from an access-controlled route, not an optimisable static asset */}
            <img src={src} alt="" />
          </div>
        );`,
      },
      // Line comments in a ternary arm — the exact shape of the real
      // justification at jars document-preview-dialog.tsx:59-61
      {
        filename: APP,
        code: `const A = ({ isImage, src, fileName }) => (
          <div>
            {isImage ? (
              // img-reason: bytes come from an access-controlled route, not an
              // optimisable static asset
              <img src={src} alt={fileName} className="max-w-full object-contain" />
            ) : null}
          </div>
        );`,
      },
      // Custom marker + relaxed length via options
      {
        filename: APP,
        code: `const A = ({ u }) => (
          <div>
            {/* raw-img: legacy */}
            <img src={u} alt="" />
          </div>
        );`,
        options: [{ marker: 'raw-img:', minReasonLength: 5 }],
      },
      // Exemptions can be switched off, but SVG then needs a reason
      {
        filename: APP,
        code: `const A = () => (
          <div>
            {/* img-reason: sprite sheet swapped at runtime by the theme switcher */}
            <img src="/sprite.svg" alt="" />
          </div>
        );`,
        options: [{ allowSvg: false }],
      },
      // Not an <img> at all
      {
        filename: APP,
        code: 'const A = () => <Image src="/hero.jpg" alt="" width={800} height={600} />;',
      },
    ],

    invalid: [
      // ── The three real defects ──────────────────────────────────────────
      // verified-docs landing-page-client.tsx:212 — LCP hero, no dimensions
      {
        filename: APP,
        code: 'const A = () => <img src="/images/landing/hero-lotus.jpg" alt="" className="h-full w-full object-cover" />;',
        errors: [{ messageId: 'rawImg', data: { marker: 'img-reason:' } }],
      },
      // :406 — has loading="lazy" but no dimensions
      {
        filename: APP,
        code: 'const A = () => <img src="/images/landing/feature-pond.jpg" alt="" loading="lazy" />;',
        errors: [{ messageId: 'rawImg' }],
      },
      // :649 — full-bleed closing CTA
      {
        filename: APP,
        code: 'const A = () => <img src="/images/landing/closing-nature.jpg" alt="" loading="lazy" />;',
        errors: [{ messageId: 'rawImg' }],
      },

      // ── Dynamic src is NOT an excuse ────────────────────────────────────
      // Real: landing-page-client.tsx:517 — sits in `relative h-[240px]`, a
      // determinate box, so this is a textbook fill + sizes case. The
      // identically-shaped doctor-card.tsx:43 does it correctly with <Image>.
      {
        filename: APP,
        code: `const A = ({ d }) => (
          <div className="relative h-[240px]">
            <img src={d.avatarUrl} alt={d.name} loading="lazy" className="block h-full w-full object-cover" />
          </div>
        );`,
        errors: [{ messageId: 'rawImg' }],
      },
      // Real: pricing-tab.tsx:45 — R2 room photo in a fixed card
      {
        filename: APP,
        code: 'const A = ({ photo }) => <img src={photo} alt="" className="h-40 w-full object-cover" />;',
        errors: [{ messageId: 'rawImg' }],
      },
      // Template literal WITH an expression is not statically knowable
      {
        filename: APP,
        code: 'const A = ({ id }) => <img src={`/api/files/${id}`} alt="" />;',
        errors: [{ messageId: 'rawImg' }],
      },

      // ── Stub annotations are called out specifically ────────────────────
      {
        filename: APP,
        code: `const A = ({ u }) => (
          <div>
            {/* img-reason: dynamic */}
            <img src={u} alt="" />
          </div>
        );`,
        errors: [
          {
            messageId: 'reasonTooShort',
            data: { marker: 'img-reason:', min: '20', reason: 'dynamic' },
          },
        ],
      },

      // ── A comment BELOW the tag does not count ──────────────────────────
      {
        filename: APP,
        code: `const A = ({ u }) => (
          <div>
            <img src={u} alt="" />
            {/* img-reason: this is underneath and therefore does not apply to it */}
          </div>
        );`,
        errors: [{ messageId: 'rawImg' }],
      },

      // ── A marker on a DIFFERENT element does not leak to the next one ───
      {
        filename: APP,
        code: `const A = ({ a, b }) => (
          <div>
            {/* img-reason: first one is genuinely unmeasurable at render time */}
            <img src={a} alt="" />
            <img src={b} alt="" />
          </div>
        );`,
        errors: [{ messageId: 'rawImg' }],
      },

      // ── Exemptions honour their options ─────────────────────────────────
      {
        filename: APP,
        code: 'const A = () => <img src="/logo.svg" alt="" />;',
        options: [{ allowSvg: false }],
        errors: [{ messageId: 'rawImg' }],
      },
      {
        filename: APP,
        code: 'const A = () => <img src="data:image/png;base64,iVBORw0KGgo=" alt="" />;',
        options: [{ allowDataUri: false }],
        errors: [{ messageId: 'rawImg' }],
      },
      // ignorePaths is replaced, not merged — src/emails/ is no longer exempt
      {
        filename: '/repo/src/emails/EmailInvoice.tsx',
        code: 'const A = () => <img src="/logo.png" alt="" />;',
        options: [{ ignorePaths: ['src/vendor/'] }],
        errors: [{ messageId: 'rawImg' }],
      },

      // ── A sibling <img> inside <picture> is still flagged ───────────────
      {
        filename: APP,
        code: `const A = () => (
          <div>
            <picture>
              <img src="/hero.jpg" alt="" />
            </picture>
            <img src="/other.jpg" alt="" />
          </div>
        );`,
        errors: [{ messageId: 'rawImg' }],
      },
    ],
  });
});
