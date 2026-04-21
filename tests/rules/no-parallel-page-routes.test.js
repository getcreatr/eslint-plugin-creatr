import { describe, beforeEach, afterAll } from 'bun:test';
import { RuleTester } from 'eslint';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rule from '../../lib/rules/no-parallel-page-routes.js';

// Each test fixture lays out a real `app/` tree on disk under a temp dir,
// because the rule walks the filesystem to index every `page.*` file.

const tmpRoots = [];

function makeFixture(layout) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creatr-parallel-'));
  tmpRoots.push(root);
  for (const [rel, body] of Object.entries(layout)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  rule._resetCache();
  return root;
}

afterAll(() => {
  for (const root of tmpRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const PAGE_SRC = 'export default function Page() { return null; }';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

describe('no-parallel-page-routes rule', () => {
  // ---- scenario: two route groups collide on /:orgSlug ----
  const collisionRoot = makeFixture({
    'src/app/(admin)/[orgSlug]/page.tsx': PAGE_SRC,
    'src/app/(employee)/[orgSlug]/page.tsx': PAGE_SRC,
    'src/app/(owner)/page.tsx': PAGE_SRC,
  });
  const collisionFileA = path.join(
    collisionRoot,
    'src/app/(admin)/[orgSlug]/page.tsx',
  );
  const collisionFileB = path.join(
    collisionRoot,
    'src/app/(employee)/[orgSlug]/page.tsx',
  );
  const ownerOnly = path.join(collisionRoot, 'src/app/(owner)/page.tsx');

  // ---- scenario: clean layout, distinct routes ----
  const cleanRoot = makeFixture({
    'src/app/page.tsx': PAGE_SRC,
    'src/app/(marketing)/about/page.tsx': PAGE_SRC,
    'src/app/(marketing)/pricing/page.tsx': PAGE_SRC,
    'src/app/dashboard/page.tsx': PAGE_SRC,
    'src/app/dashboard/_components/helper.ts':
      'export const x = 1;',
    'src/app/_lib/server.ts': 'export const y = 1;',
  });
  const cleanRootPage = path.join(cleanRoot, 'src/app/page.tsx');
  const cleanAbout = path.join(cleanRoot, 'src/app/(marketing)/about/page.tsx');

  // ---- scenario: private folder suppresses collision ----
  const privateRoot = makeFixture({
    'src/app/(admin)/page.tsx': PAGE_SRC,
    'src/app/_drafts/page.tsx': PAGE_SRC,
  });
  const privateDraft = path.join(privateRoot, 'src/app/_drafts/page.tsx');
  const privateAdmin = path.join(privateRoot, 'src/app/(admin)/page.tsx');

  beforeEach(() => {
    rule._resetCache();
  });

  ruleTester.run('no-parallel-page-routes', rule, {
    valid: [
      // Non-page files never report, even at the app root
      {
        code: 'export const x = 1;',
        filename: path.join(collisionRoot, 'src/app/layout.tsx'),
      },
      // File outside any app/ directory is a no-op
      {
        code: PAGE_SRC,
        filename: path.join(collisionRoot, 'tools/page.tsx'),
      },
      // Distinct routes — no collision
      {
        code: PAGE_SRC,
        filename: cleanRootPage,
      },
      {
        code: PAGE_SRC,
        filename: cleanAbout,
      },
      // A unique page in the collision fixture still validates
      {
        code: PAGE_SRC,
        filename: ownerOnly,
      },
      // Pages inside private `_` folders do not participate in routing
      {
        code: PAGE_SRC,
        filename: privateDraft,
      },
      {
        code: PAGE_SRC,
        filename: privateAdmin,
      },
    ],
    invalid: [
      {
        code: PAGE_SRC,
        filename: collisionFileA,
        errors: [{ messageId: 'parallelPageCollision' }],
      },
      {
        code: PAGE_SRC,
        filename: collisionFileB,
        errors: [{ messageId: 'parallelPageCollision' }],
      },
    ],
  });
});
