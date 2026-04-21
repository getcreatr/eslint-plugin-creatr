'use strict';

// Detects Next.js App Router route collisions where two or more `page.*` files
// resolve to the same URL path — the same condition that produces the runtime
// error: "You cannot have two parallel pages that resolve to the same path".
//
// This rule scans the project's `app/` directory once per process, computes
// the resolved URL path for each `page.*` file (stripping route groups `(...)`
// and ignoring private `_foo` subtrees), and reports a collision on every
// conflicting page file.

const fs = require('fs');
const path = require('path');

const PAGE_FILE = /^page\.(?:js|jsx|ts|tsx|mjs|cjs)$/;

// Cache: absolute `app` root → Map<normalizedRoute, Set<absoluteFile>>
const routeIndexCache = new Map();

function isRouteGroup(segment) {
  return segment.startsWith('(') && segment.endsWith(')');
}

function isPrivateFolder(segment) {
  // Next.js treats folders starting with `_` as private — they are not part of
  // the route tree at all, so pages inside them don't resolve to a URL.
  return segment.startsWith('_');
}

function scanAppRoot(appRoot) {
  const routes = new Map();

  function walk(dir, segments) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isPrivateFolder(entry.name)) continue;
        if (isRouteGroup(entry.name)) {
          walk(full, segments);
        } else {
          walk(full, segments.concat(entry.name));
        }
      } else if (PAGE_FILE.test(entry.name)) {
        const route = '/' + segments.join('/');
        if (!routes.has(route)) routes.set(route, new Set());
        routes.get(route).add(full);
      }
    }
  }

  walk(appRoot, []);
  return routes;
}

function findAppRoot(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const norm = filename.replace(/\\/g, '/');
  const markers = ['/src/app/', '/app/'];
  for (const marker of markers) {
    const idx = norm.lastIndexOf(marker);
    if (idx !== -1) return norm.slice(0, idx + marker.length - 1);
  }
  return null;
}

function computeRouteForFile(filename, appRoot) {
  const relative = path.relative(appRoot, filename).replace(/\\/g, '/');
  const parts = relative.split('/');
  const basename = parts.pop();
  if (!PAGE_FILE.test(basename)) return null;

  const segments = [];
  for (const seg of parts) {
    if (isPrivateFolder(seg)) return null;
    if (isRouteGroup(seg)) continue;
    segments.push(seg);
  }
  return '/' + segments.join('/');
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow multiple Next.js App Router `page` files that resolve to the same URL path (typically caused by conflicting route groups).',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/building-your-application/routing/route-groups',
    },
    messages: {
      parallelPageCollision:
        'Route collision: this page resolves to "{{ route }}" but is also defined in: {{ others }}. Next.js cannot have two parallel pages that resolve to the same path.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          appDir: {
            type: 'string',
            description:
              'Absolute path to the Next.js `app` directory. If omitted, the rule infers it from each file path.',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const filename =
      (typeof context.filename === 'string' && context.filename) ||
      (typeof context.getFilename === 'function' && context.getFilename()) ||
      '';

    if (!filename || filename === '<input>' || filename === '<text>') {
      return {};
    }

    const normalizedFilename = filename.replace(/\\/g, '/');
    const basename = path.basename(normalizedFilename);
    if (!PAGE_FILE.test(basename)) return {};

    const appRoot = options.appDir
      ? options.appDir.replace(/\\/g, '/').replace(/\/$/, '')
      : findAppRoot(normalizedFilename);
    if (!appRoot) return {};

    return {
      Program(node) {
        let index = routeIndexCache.get(appRoot);
        if (!index) {
          index = scanAppRoot(appRoot);
          routeIndexCache.set(appRoot, index);
        }

        const route = computeRouteForFile(normalizedFilename, appRoot);
        if (!route) return;

        const files = index.get(route);
        if (!files || files.size <= 1) return;

        const cwd =
          (typeof context.cwd === 'string' && context.cwd) ||
          (typeof context.getCwd === 'function' && context.getCwd()) ||
          process.cwd();

        const others = [...files]
          .filter((f) => f.replace(/\\/g, '/') !== normalizedFilename)
          .map((f) => path.relative(cwd, f));

        if (others.length === 0) return;

        context.report({
          node,
          messageId: 'parallelPageCollision',
          data: {
            route: route === '' ? '/' : route,
            others: others.join(', '),
          },
        });
      },
    };
  },

  // Exposed for tests — lets specs reset cached filesystem scans between runs.
  _resetCache() {
    routeIndexCache.clear();
  },
};
