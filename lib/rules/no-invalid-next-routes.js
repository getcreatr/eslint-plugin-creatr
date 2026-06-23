'use strict';

const fs = require('fs');
const path = require('path');

// Cache scanned route patterns per appDir to avoid re-scanning on every file
const patternCache = new Map();

/**
 * Walk the Next.js app directory and collect valid route patterns.
 *
 * Each entry has:
 *   match:   string[] — used for matching; '*' = dynamic segment, '**' = catch-all
 *   display: string[] — human-readable; '[id]', '[...slug]', or a literal name
 *
 * Route groups like (admin) are transparent — stripped from both arrays.
 * The api/ directory is skipped (API routes are not page routes).
 */
function buildRoutePatterns(appDir) {
  if (patternCache.has(appDir)) return patternCache.get(appDir);

  const patterns = [];

  function walk(dir, matchSegs, displaySegs) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'api') continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Route group: (name) — transparent in URL, don't add to segments
        if (/^\(.+\)$/.test(entry.name)) {
          walk(fullPath, matchSegs, displaySegs);
          continue;
        }

        // Catch-all: [...param]
        if (/^\[\.\.\./.test(entry.name)) {
          walk(fullPath, [...matchSegs, '**'], [...displaySegs, entry.name]);
          continue;
        }

        // Dynamic: [param]
        if (/^\[/.test(entry.name)) {
          walk(fullPath, [...matchSegs, '*'], [...displaySegs, entry.name]);
          continue;
        }

        walk(fullPath, [...matchSegs, entry.name], [...displaySegs, entry.name]);
      } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
        patterns.push({ match: [...matchSegs], display: [...displaySegs] });
      }
    }
  }

  walk(appDir, [], []);
  patternCache.set(appDir, patterns);
  return patterns;
}

/** Split a URL into segments, stripping query string and hash. */
function urlToSegments(urlPath) {
  const clean = urlPath.split(/[?#]/)[0];
  return clean.split('/').filter(Boolean);
}

/**
 * Convert a TemplateLiteral node to a segment array.
 * Each interpolated expression becomes the placeholder '*'.
 */
function templateLiteralToSegments(node) {
  let combined = '';
  for (let i = 0; i < node.quasis.length; i++) {
    combined += node.quasis[i].value.cooked ?? node.quasis[i].value.raw;
    if (i < node.expressions.length) combined += '\x00*\x00';
  }
  const clean = combined.split(/[?#]/)[0];
  return clean.split('/').filter(Boolean).map(seg =>
    seg.includes('\x00*\x00') ? '*' : seg
  );
}

/** Build a readable display string for a TemplateLiteral (e.g. `/tenants/${...}/onboarding`). */
function templateLiteralToDisplay(node) {
  let out = '`';
  for (let i = 0; i < node.quasis.length; i++) {
    out += node.quasis[i].value.raw;
    if (i < node.expressions.length) out += '${...}';
  }
  return out + '`';
}

/**
 * Check whether urlSegs match a single route pattern.
 *   '**' in a pattern eats all remaining URL segments (catch-all).
 *   '*'  in a pattern OR URL matches any single segment (bidirectional wildcard).
 *   Otherwise segments must be identical.
 */
function patternMatchesUrl(matchSegs, urlSegs) {
  let pi = 0;
  let ui = 0;

  while (pi < matchSegs.length) {
    if (matchSegs[pi] === '**') return true;
    if (ui >= urlSegs.length) return false;

    const ps = matchSegs[pi];
    const us = urlSegs[ui];
    if (ps !== '*' && us !== '*' && ps !== us) return false;

    pi++;
    ui++;
  }

  return ui === urlSegs.length;
}

function matchesAnyPattern(urlSegs, patterns) {
  if (urlSegs.length === 0) return true; // root '/'
  return patterns.some(({ match }) => patternMatchesUrl(match, urlSegs));
}


/**
 * Extract the path info from a node for validation.
 * Returns { segs, display } or null when the path can't be statically determined.
 *
 * LIMITATION: Template literals whose FIRST token is an expression (a runtime
 * variable) are skipped — e.g. `${basePath}/${id}` — because we cannot know
 * what `basePath` holds at lint time. Only paths where the static prefix
 * begins with '/' are analysed.
 */
function extractPath(node) {
  if (!node) return null;

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return { segs: urlToSegments(node.value), display: node.value };
  }

  if (node.type === 'TemplateLiteral') {
    const firstStatic = node.quasis[0]?.value?.cooked ?? '';
    if (!firstStatic.startsWith('/')) return null; // starts with a variable — can't check
    return {
      segs: templateLiteralToSegments(node),
      display: templateLiteralToDisplay(node),
    };
  }

  return null;
}

// ─── Rule ─────────────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow navigation to routes that have no corresponding page.tsx in the Next.js app directory',
      category: 'Next.js',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          // Path to the Next.js app directory, relative to CWD. Defaults to 'src/app'.
          appDir: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidRoute:
        'Route "{{path}}" does not exist — no page.tsx was found at this path. ' +
        'Verify the route exists in the app directory or correct the path.',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const cwd = context.getCwd ? context.getCwd() : process.cwd();
    const appDir = options.appDir
      ? path.resolve(cwd, options.appDir)
      : path.resolve(cwd, 'src/app');

    const patterns = buildRoutePatterns(appDir);

    if (patterns.length === 0) return {}; // couldn't find app dir — skip silently

    function check(pathNode) {
      const extracted = extractPath(pathNode);
      if (!extracted) return;

      const { segs, display } = extracted;

      // Only check absolute internal paths
      if (!display.startsWith('/') && !display.startsWith('`/')) return;
      if (display.startsWith('http://') || display.startsWith('https://') || display.startsWith('//')) return;

      // Skip entirely-dynamic paths like `${basePath}/${id}` — all segments are '*',
      // meaning every segment is unknown at lint time and we'd get false positives
      if (segs.length > 0 && segs.every(s => s === '*')) return;

      if (matchesAnyPattern(segs, patterns)) return;

      context.report({
        node: pathNode,
        messageId: 'invalidRoute',
        data: { path: display },
      });
    }

    return {
      // <Link href="..." /> or <Link href={`...`} />
      JSXAttribute(node) {
        if (node.name.name !== 'href') return;

        const opening = node.parent;
        if (opening?.type !== 'JSXOpeningElement') return;
        if (
          opening.name.type !== 'JSXIdentifier' ||
          opening.name.name !== 'Link'
        ) return;

        if (!node.value) return;

        if (node.value.type === 'Literal') {
          check(node.value);
        } else if (node.value.type === 'JSXExpressionContainer') {
          check(node.value.expression);
        }
      },

      // router.push(...) / router.replace(...)
      CallExpression(node) {
        const callee = node.callee;
        if (!node.arguments.length) return;

        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'router' &&
          callee.property.type === 'Identifier' &&
          (callee.property.name === 'push' || callee.property.name === 'replace')
        ) {
          check(node.arguments[0]);
          return;
        }

        if (callee.type === 'Identifier' && callee.name === 'redirect') {
          check(node.arguments[0]);
        }
      },

      // window.location.href = '...'
      AssignmentExpression(node) {
        const left = node.left;
        if (
          left.type === 'MemberExpression' &&
          left.object.type === 'MemberExpression' &&
          left.object.object.type === 'Identifier' &&
          left.object.object.name === 'window' &&
          left.object.property.name === 'location' &&
          left.property.name === 'href'
        ) {
          check(node.right);
        }
      },
    };
  },
};
