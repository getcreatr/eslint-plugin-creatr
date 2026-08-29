import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-imperative-navigation.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

const APP = '/repo/src/features/x/components/thing.tsx';
const R = 'const router = useRouter();';

describe('no-imperative-navigation rule', () => {
  ruleTester.run('no-imperative-navigation', rule, {
    valid: [
      // ── Auto-exempt: { scroll: false } — the URL-state write of §3.6 ──────
      // Real shape: use-institution-url-state.ts:39. 24 of 24 url-state calls
      // in the audited app carry this, and nothing else does.
      {
        filename: APP,
        code: `${R} function f(){ router.replace(qs ? \`\${pathname}?\${qs}\` : pathname, { scroll: false }); }`,
        options: [{ methods: ['push', 'replace'] }],
      },
      // Inside startTransition — use-leads-url-state.ts:42
      {
        filename: APP,
        code: `${R} function f(){ startTransition(() => { router.replace(url, { scroll: false }); }); }`,
        options: [{ methods: ['push', 'replace'] }],
      },
      // push with { scroll: false } is equally a URL-state write
      {
        filename: APP,
        code: `${R} function f(){ router.push('/crm/arrivals?date=1', { scroll: false }); }`,
      },
      // Quoted key
      {
        filename: APP,
        code: `${R} function f(){ router.replace(u, { 'scroll': false }); }`,
        options: [{ methods: ['push', 'replace'] }],
      },

      // ── Auto-exempt: post-mutation redirect ──────────────────────────────
      // Real shape: institution-create-form.tsx:62 — the id does not exist
      // until the action returns, so there is no href to put in a <Link>.
      {
        filename: APP,
        code: `${R} const a = useAction(create, { onSuccess: ({ data }) => { router.push(\`/admin/institutions/\${data?.id}\`); } });`,
      },
      {
        filename: APP,
        code: `${R} const a = useAction(x, { onError: () => { router.replace('/login'); } });`,
        options: [{ methods: ['push', 'replace'] }],
      },
      // Auth callback — login/page.tsx:68. Same onSuccess shape, no separate rule.
      {
        filename: APP,
        code: `${R} const a = useAction(signIn, { onSuccess: async ({ data }) => { router.push(data.redirectTo); } });`,
      },
      // onSuccess as a JSX PROP, not an object property — question-queue-client.tsx:109.
      // Matching only object properties misses this shape entirely.
      {
        filename: APP,
        code: `${R}\nconst A = () => <QuestionForm onSuccess={(r) => { router.push(`+"`"+`/admin/knowledge/questions/${'${'}r.id}`+"`"+`); }} />;`,
      },
      // Sequenced after an await — two-tap-reason-form.tsx:70. A <Link> navigates
      // on click; it cannot wait for an async step to resolve first.
      {
        filename: APP,
        code: `${R} async function submit(){ const result = await execute(x); if (result?.serverError) return; router.push('/email-action/revise?done=1'); }`,
      },
      // ...but an await INSIDE a nested function does not exempt the outer call
      // Nested inside a setTimeout within onSuccess — reset-password-form.tsx:56
      {
        filename: APP,
        code: `${R} const a = useAction(x, { onSuccess: () => { setTimeout(() => router.push('/login'), 2000); } });`,
      },

      // ── Not matched at all: no target URL to put in an href ──────────────
      { filename: APP, code: `${R} function f(){ router.back(); }` },
      { filename: APP, code: `${R} function f(){ router.forward(); }` },
      { filename: APP, code: `${R} function f(){ router.refresh(); }` },

      // ── Not a Next router ────────────────────────────────────────────────
      {
        filename: APP,
        code: `const history = createHistory(); function f(){ history.push('/x'); }`,
      },
      // A comment showing the pattern is not a call — list-results.tsx:48
      {
        filename: APP,
        code: `${R}\n// startTransition(() => router.replace(url, { scroll: false }));\nexport const x = 1;`,
      },

      // ── Silenced by a reason comment ─────────────────────────────────────
      // Statement form
      {
        filename: APP,
        code: `${R} function f(){\n  // link-reason: dnd-kit drag handle; a nested anchor swallows the drag gesture\n  router.push(href);\n}`,
      },
      // JSX sibling comment form
      {
        filename: APP,
        code: `${R}\nconst A = () => (\n  <div>\n    {/* link-reason: sonner action button styling only applies to the callback form */}\n    <Toast onAction={() => router.push('/crm/leads')} />\n  </div>\n);`,
      },
      // Above the JSX attribute
      {
        filename: APP,
        code: `${R}\nconst A = () => (\n  <Button\n    // link-reason: target is chosen by a server response, not known at render\n    onClick={() => router.push(target)}\n  />\n);`,
      },
      // Custom marker + relaxed length
      {
        filename: APP,
        code: `${R} function f(){\n  // nav: legacy\n  router.push('/x');\n}`,
        options: [{ marker: 'nav:', minReasonLength: 5 }],
      },
      // `replace` is NOT reported by default — it is legitimate far more often
      // (url-state writes, modal dismissal, post-mutation) and reporting it would
      // lean hard on exemption-detection being right.
      {
        filename: APP,
        code: `${R}\nconst A = () => <Button onClick={() => router.replace('/settings')} />;`,
      },
      // ignorePaths
      {
        filename: '/repo/src/legacy/old.tsx',
        code: `${R} function f(){ router.push('/x'); }`,
        options: [{ ignorePaths: ['src/legacy/'] }],
      },
    ],

    invalid: [
      // ── The real defects found in the audited app ────────────────────────
      // DataTable.tsx:95 — row navigation baked into a shared primitive (§5.3)
      {
        filename: APP,
        code: `${R}\nconst Tr = ({ to }) => <tr onClick={() => { if (to) router.push(to); }} />;`,
        errors: [{ messageId: 'imperativeNav', data: { marker: 'link-reason:', method: 'push' } }],
      },
      // non-draft-lead-card.tsx:145 — a div reimplementing an anchor
      {
        filename: APP,
        code: `${R}\nconst A = ({ lead }) => (\n  <div role="link" tabIndex={0} onClick={() => router.push(getLeadHref(lead))} />\n);`,
        errors: [{ messageId: 'imperativeNav' }],
      },
      // :148 — the hand-rolled keyboard half of the same element
      {
        filename: APP,
        code: `${R}\nconst A = ({ lead }) => (\n  <div onKeyDown={(e) => { if (e.key === 'Enter') router.push(getLeadHref(lead)); }} />\n);`,
        errors: [{ messageId: 'imperativeNav' }],
      },
      // Static literal on a plain button — csv-import-results.tsx:129
      {
        filename: APP,
        code: `${R}\nconst A = () => <Button onClick={() => router.push('/crm/leads')} />;`,
        errors: [{ messageId: 'imperativeNav' }],
      },
      // arrivals-view.tsx:25 — filter state via push, NO { scroll: false }.
      // Deliberately still reported: it violates §3.6 as well as §5.8.
      {
        filename: APP,
        code: `${R} function go(date){ router.push(\`/crm/arrivals?date=\${date}\`); }`,
        errors: [{ messageId: 'imperativeNav' }],
      },
      // Toast action — sonner 2 accepts a ReactNode, so this IS convertible
      {
        filename: APP,
        code: `${R} function f(){ toast('x', { action: { label: 'View', onClick: () => router.push('/crm/leads/1') } }); }`,
        errors: [{ messageId: 'imperativeNav' }],
      },
      // Menu item — Radix supports asChild, so a <Link> fits
      {
        filename: APP,
        code: `${R}\nconst A = ({ lead }) => <DropdownMenuItem onSelect={() => router.push(\`/crm/leads/\${lead.id}\`)} />;`,
        errors: [{ messageId: 'imperativeNav' }],
      },

      // A non-async click handler is still reported even if something nearby awaits
      {
        filename: APP,
        code: `${R}\nconst A = () => <Button onClick={() => router.push('/x')} />;\nasync function other(){ await y(); }`,
        errors: [{ messageId: 'imperativeNav' }],
      },

      // ── Detection must survive a renamed router variable ─────────────────
      {
        filename: APP,
        code: `const r = useRouter();\nconst A = () => <Button onClick={() => r.push('/x')} />;`,
        errors: [{ messageId: 'imperativeNav' }],
      },

      // ── replace stays reportable, but only when opted in ────────────────
      {
        filename: APP,
        code: `${R}\nconst A = () => <Button onClick={() => router.replace('/settings')} />;`,
        options: [{ methods: ['push', 'replace'] }],
        errors: [{ messageId: 'imperativeNav', data: { marker: 'link-reason:', method: 'replace' } }],
      },

      // ── { scroll: true } is not the URL-state shape ──────────────────────
      {
        filename: APP,
        code: `${R} function f(){ router.push('/x', { scroll: true }); }`,
        errors: [{ messageId: 'imperativeNav' }],
      },

      // ── Stub reasons are called out specifically ─────────────────────────
      {
        filename: APP,
        code: `${R} function f(){\n  // link-reason: dynamic\n  router.push(u);\n}`,
        errors: [
          {
            messageId: 'reasonTooShort',
            data: { marker: 'link-reason:', min: '20', reason: 'dynamic' },
          },
        ],
      },

      // ── A marker on a DIFFERENT element does not leak to the next one ────
      {
        filename: APP,
        code: `${R}\nconst A = () => (\n  <div>\n    {/* link-reason: this one is genuinely imperative for a real reason */}\n    <Button onClick={() => router.push('/a')} />\n    <Button onClick={() => router.push('/b')} />\n  </div>\n);`,
        errors: [{ messageId: 'imperativeNav' }],
      },
    ],
  });
});
