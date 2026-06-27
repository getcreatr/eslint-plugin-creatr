// tests/rules/no-invalid-next-routes.test.js
import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-invalid-next-routes.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

// Build a minimal fake app directory for deterministic tests.
// Structure (mirrors a typical Next.js App Router project):
//
//   app/
//     page.tsx                          → /
//     (auth)/
//       login/page.tsx                  → /login
//       forgot-password/page.tsx        → /forgot-password
//     (operational)/
//       dashboard/page.tsx              → /dashboard
//       tenants/
//         page.tsx                      → /tenants
//         [id]/
//           onboarding/
//             page.tsx                  → /tenants/[id]/onboarding
//             [task_id]/page.tsx        → /tenants/[id]/onboarding/[task_id]
//           assets/
//             page.tsx                  → /tenants/[id]/assets
//             [...all]/page.tsx         → /tenants/[id]/assets/[...all]  (catch-all)
//     api/
//       users/route.ts                  → skipped (API route, not a page)

function buildFakeAppDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'creatr-eslint-test-'));

  const dirs = [
    'app',
    'app/(auth)/login',
    'app/(auth)/forgot-password',
    'app/(operational)/dashboard',
    'app/(operational)/tenants',
    'app/(operational)/tenants/[id]/onboarding',
    'app/(operational)/tenants/[id]/onboarding/[task_id]',
    'app/(operational)/tenants/[id]/assets',
    'app/(operational)/tenants/[id]/assets/[...all]',
    'app/api/users',
  ];

  for (const d of dirs) {
    fs.mkdirSync(path.join(base, d), { recursive: true });
  }

  const pages = [
    'app/page.tsx',
    'app/(auth)/login/page.tsx',
    'app/(auth)/forgot-password/page.tsx',
    'app/(operational)/dashboard/page.tsx',
    'app/(operational)/tenants/page.tsx',
    'app/(operational)/tenants/[id]/onboarding/page.tsx',
    'app/(operational)/tenants/[id]/onboarding/[task_id]/page.tsx',
    'app/(operational)/tenants/[id]/assets/page.tsx',
    'app/(operational)/tenants/[id]/assets/[...all]/page.tsx',
    // API routes are NOT pages — the rule must ignore them
    'app/api/users/route.ts',
  ];

  for (const f of pages) {
    fs.writeFileSync(path.join(base, f), '');
  }

  return path.join(base, 'app');
}

const APP_DIR = buildFakeAppDir();
const OPT = [{ appDir: APP_DIR }];

describe('no-invalid-next-routes rule', () => {
  ruleTester.run('no-invalid-next-routes', rule, {
    valid: [
      // ── Root ────────────────────────────────────────────────────────────────
      // Root '/' always matches
      { code: '<Link href="/">Home</Link>', options: OPT },
      { code: 'router.push("/")', options: OPT },

      // ── Static literal paths that exist ─────────────────────────────────────
      { code: '<Link href="/login">Login</Link>', options: OPT },
      { code: '<Link href="/dashboard">Dashboard</Link>', options: OPT },
      { code: '<Link href="/tenants">Tenants</Link>', options: OPT },
      { code: 'router.push("/forgot-password")', options: OPT },
      { code: 'redirect("/login")', options: OPT },

      // ── Template literals with dynamic segments — known valid structure ──────
      { code: '<Link href={`/tenants/${id}/onboarding`}>Go</Link>', options: OPT },
      { code: '<Link href={`/tenants/${id}/onboarding/${taskId}`}>Go</Link>', options: OPT },
      { code: '<Link href={`/tenants/${id}/assets`}>Assets</Link>', options: OPT },
      { code: 'router.push(`/tenants/${id}/onboarding`)', options: OPT },
      { code: 'redirect(`/tenants/${id}/onboarding/${taskId}`)', options: OPT },

      // ── Catch-all route — any sub-path under /tenants/[id]/assets matches ───
      { code: '<Link href={`/tenants/${id}/assets/folder/sub`}>Deep</Link>', options: OPT },

      // ── Path with query string or hash — stripped before matching ────────────
      { code: '<Link href="/login?redirect=/dashboard">Login</Link>', options: OPT },
      { code: 'router.push("/tenants?page=2")', options: OPT },
      { code: 'router.push("/login#section")', options: OPT },

      // ── Cases the rule CANNOT catch (silently skipped — no false positives) ────
      //
      // 1. Template literal whose FIRST token is a runtime variable.
      //    The rule reads firstQuasi to determine if the path starts with '/'.
      //    When the literal opens with an expression, firstQuasi is '' — the rule
      //    exits immediately because the base path is unknown at lint time.
      //
      //    Example from onboarding-queue.tsx:
      //      <Link href={`${basePath}/${task.id}`}>View</Link>
      //    basePath is a prop — could be anything. No way to validate statically.
      { code: '<Link href={`${basePath}/${id}`}>View</Link>', options: OPT },
      { code: 'router.push(`${prefix}/${page}`)', options: OPT },
      { code: 'router.replace(`${base}/settings`)', options: OPT },
      //
      // 2. Non-literal arguments (variables, function calls).
      //    The rule only inspects string literals and template literals.
      { code: 'router.push(getPath())', options: OPT },
      { code: 'router.push(pathVar)', options: OPT },
      { code: '<Link href={buildUrl(id)}>Go</Link>', options: OPT },
      //
      // 3. Relative paths (no leading '/').
      //    Caught by the separate `creatr/no-hardcoded-redirect-urls` rule.
      //    This rule skips them to avoid double-reporting.
      { code: 'router.push("dashboard")', options: OPT },
      { code: 'router.push("tenants/onboarding")', options: OPT },
      //
      // 4. External URLs.
      { code: 'router.push("https://example.com")', options: OPT },
      { code: '<Link href="http://external.com/page">Ext</Link>', options: OPT },

      // ── window.location.href with valid path ─────────────────────────────────
      { code: 'window.location.href = "/login"', options: OPT },

      // ── router.replace ───────────────────────────────────────────────────────
      { code: 'router.replace("/tenants")', options: OPT },
      { code: 'router.replace(`/tenants/${id}/onboarding`)', options: OPT },
    ],

    invalid: [
      // ── Static literal pointing to a non-existent route ──────────────────────
      {
        // /tenants/[id] has no page.tsx — only sub-routes exist under it.
        code: '<Link href="/tenants/some-id">Detail</Link>',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
      {
        code: 'router.push("/tenants/some-id")',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
      {
        code: 'redirect("/tenants/some-id")',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
      {
        // Completely unknown top-level route — no related routes exist
        code: '<Link href="/admin/settings">Settings</Link>',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
      {
        code: 'router.push("/nonexistent")',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },

      // ── Template literal with known-bad static segments ───────────────────────
      {
        // /tenants/[id]/badroute — the static literal 'badroute' segment does not
        // match any known route under /tenants/[id]
        code: '<Link href={`/tenants/${id}/badroute`}>Go</Link>',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
      {
        // /tenants/[id] — the [id] segment resolves to '*' but there is no
        // page.tsx directly under tenants/[id], only deeper sub-routes
        code: 'router.push(`/tenants/${id}`)',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
      {
        code: 'redirect(`/tenants/${id}/missing-section`)',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },

      // ── window.location.href with bad path ───────────────────────────────────
      {
        code: 'window.location.href = "/nowhere"',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },

      // ── router.replace with bad path ─────────────────────────────────────────
      {
        code: 'router.replace("/admin/nonexistent")',
        options: OPT,
        errors: [{ messageId: 'invalidRoute' }],
      },
    ],
  });
});
