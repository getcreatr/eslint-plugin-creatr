'use strict';

const fs = require('fs');
const path = require('path');

// Cache: absolute file path → { hasUseClient: boolean, isServerOnly: boolean }
const fileCache = new Map();

// Imports that only work on the server
const SERVER_ONLY_PACKAGES = [
  'server-only',
  'next/headers',
  'next/cookies',
  'next/cache',
  'next/navigation', // useRouter etc are client, but redirect/revalidatePath are server
];

// Regex to detect async exported functions (async server components)
const ASYNC_EXPORT_RE = /export\s+(default\s+)?async\s+(function|const|let|var)\s/;

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const INDEX_FILES = EXTENSIONS.map((e) => path.join('index' + e));

/**
 * Resolve a local import specifier to an absolute file path.
 * Tries bare path + extensions, then /index + extensions.
 * Returns null if the file cannot be found.
 */
function resolveLocalPath(importPath, currentFile) {
  const dir = path.dirname(currentFile);
  const base = path.resolve(dir, importPath);

  // 1. Exact match (already has extension)
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;

  // 2. Try appending extensions
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }

  // 3. Try as directory with index file
  for (const idx of INDEX_FILES) {
    const candidate = path.join(base, idx);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Resolve a path alias (e.g. `@/components/Foo`) to an absolute file path.
 * Reads tsconfig.json from cwd to discover `paths` mapping; falls back to
 * `src/` if no tsconfig or no matching alias is found.
 */
function resolveAliasPath(importPath, cwd) {
  let tsconfigPaths = null;

  try {
    const tsconfigFile = path.join(cwd, 'tsconfig.json');
    if (fs.existsSync(tsconfigFile)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigFile, 'utf8'));
      tsconfigPaths = tsconfig?.compilerOptions?.paths || null;
    }
  } catch {
    // ignore parse errors
  }

  if (tsconfigPaths) {
    for (const [alias, targets] of Object.entries(tsconfigPaths)) {
      // Normalise alias pattern: strip trailing `*`
      const aliasPrefix = alias.replace(/\*$/, '');
      if (importPath.startsWith(aliasPrefix)) {
        const rest = importPath.slice(aliasPrefix.length);
        for (const target of targets) {
          const targetBase = path.join(cwd, target.replace(/\*$/, ''), rest);
          // Try exact, then extensions, then index
          if (fs.existsSync(targetBase) && fs.statSync(targetBase).isFile()) return targetBase;
          for (const ext of EXTENSIONS) {
            const c = targetBase + ext;
            if (fs.existsSync(c)) return c;
          }
          for (const idx of INDEX_FILES) {
            const c = path.join(targetBase, idx);
            if (fs.existsSync(c)) return c;
          }
        }
      }
    }
  }

  // Fallback: treat `@/` as `<cwd>/src/`
  if (importPath.startsWith('@/')) {
    const rest = importPath.slice(2);
    const base = path.join(cwd, 'src', rest);
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    for (const ext of EXTENSIONS) {
      const c = base + ext;
      if (fs.existsSync(c)) return c;
    }
    for (const idx of INDEX_FILES) {
      const c = path.join(base, idx);
      if (fs.existsSync(c)) return c;
    }
  }

  return null;
}

/**
 * Analyze a file to determine:
 * - hasUseClient: has "use client" directive → safe to use in client components
 * - isServerOnly: has explicit server-only signals (server-only import, Next.js
 *   server APIs, or async exported component) → unsafe in client components
 *
 * Pure presentational files (no "use client", no server-only signals) are
 * treated as shared components — safe in both contexts, not flagged.
 *
 * Results are cached.
 */
function analyzeFile(absolutePath) {
  if (fileCache.has(absolutePath)) return fileCache.get(absolutePath);

  const result = { hasUseClient: false, isServerOnly: false };

  try {
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');

    // Check first non-empty line for "use client"
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const stripped = trimmed.replace(/^['"]|['"];?$/g, '');
      if (stripped === 'use client') {
        result.hasUseClient = true;
      }
      break;
    }

    if (!result.hasUseClient) {
      // Check for server-only package imports
      // Matches: import 'pkg', import ... from 'pkg', require('pkg')
      for (const pkg of SERVER_ONLY_PACKAGES) {
        const escaped = pkg.replace('/', '\\/');
        const importRe = new RegExp(
          `(import\\s+['"]${escaped}['"]|import\\s[^'"]*from\\s['"]${escaped}['"]|require\\(['"]${escaped}['"]\\))`,
        );
        if (importRe.test(content)) {
          result.isServerOnly = true;
          break;
        }
      }

      // Check for async exported component
      if (!result.isServerOnly && ASYNC_EXPORT_RE.test(content)) {
        result.isServerOnly = true;
      }
    }
  } catch {
    // If we can't read the file, be conservative — don't flag it
  }

  fileCache.set(absolutePath, result);
  return result;
}

/**
 * Returns true if the import specifier is a local path (relative or alias),
 * not a bare node_modules specifier.
 */
function isLocalImport(specifier) {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('@/')
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing and rendering server components inside client components ("use client")',
      category: 'Next.js',
      recommended: true,
      url: 'https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#unsupported-pattern-importing-server-components-into-client-components',
    },
    fixable: null,
    schema: [],
    messages: {
      serverComponentInClient:
        '"{{name}}" is a server component (no "use client" in {{file}}) and cannot be rendered inside a client component. Move it above the client boundary or add "use client" to {{file}}.',
    },
  },

  create(context) {
    const filename =
      (typeof context.filename === 'string' && context.filename) ||
      (typeof context.getFilename === 'function' && context.getFilename()) ||
      '';

    if (!filename || filename === '<input>' || filename === '<text>') {
      return {};
    }

    const cwd =
      (typeof context.cwd === 'string' && context.cwd) ||
      (typeof context.getCwd === 'function' && context.getCwd()) ||
      process.cwd();

    let isClientComponent = false;

    // Map: local identifier name → { resolvedPath, importedName }
    const localServerImports = new Map();

    return {
      Program(node) {
        isClientComponent = false;
        localServerImports.clear();

        const firstStatement = node.body[0];
        if (
          firstStatement &&
          firstStatement.type === 'ExpressionStatement' &&
          firstStatement.expression.type === 'Literal' &&
          (firstStatement.expression.value === 'use client' ||
            firstStatement.expression.value === 'use client;')
        ) {
          isClientComponent = true;
        }
      },

      ImportDeclaration(node) {
        if (!isClientComponent) return;

        const specifier = node.source.value;
        if (!isLocalImport(specifier)) return;

        // Skip type-only imports
        if (node.importKind === 'type') return;

        // Resolve to an absolute path
        let resolved = null;
        if (specifier.startsWith('@/')) {
          resolved = resolveAliasPath(specifier, cwd);
        } else {
          resolved = resolveLocalPath(specifier, filename);
        }

        if (!resolved) return;

        const analysis = analyzeFile(resolved);

        // If the imported file has "use client", it's a client component — safe
        if (analysis.hasUseClient) return;

        // If the imported file has no server-only signals, it's a shared
        // presentational component — safe to use in client components
        if (!analysis.isServerOnly) return;

        // Collect all imported local names from this server file
        for (const imp of node.specifiers) {
          // Skip namespace imports (import * as X) — can't easily track JSX usage
          if (imp.type === 'ImportNamespaceSpecifier') continue;
          // Skip type-only specifiers
          if (imp.importKind === 'type') continue;

          const localName = imp.local.name;
          localServerImports.set(localName, {
            resolvedPath: resolved,
            node: imp,
          });
        }
      },

      JSXOpeningElement(node) {
        if (!isClientComponent) return;
        if (localServerImports.size === 0) return;

        // Get the component name (handles <Foo />, not <foo.bar />)
        let name = null;
        if (node.name.type === 'JSXIdentifier') {
          name = node.name.name;
        } else if (
          node.name.type === 'JSXMemberExpression' &&
          node.name.object.type === 'JSXIdentifier'
        ) {
          // e.g. <Namespace.Component /> — check the root object
          name = node.name.object.name;
        }

        if (!name) return;

        const info = localServerImports.get(name);
        if (!info) return;

        const relPath = path.relative(cwd, info.resolvedPath);

        context.report({
          node,
          messageId: 'serverComponentInClient',
          data: {
            name,
            file: relPath,
          },
        });
      },
    };
  },

  // Exposed for tests — lets specs reset the file cache between runs
  _resetCache() {
    fileCache.clear();
  },
};
