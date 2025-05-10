// tests/rules/require-suspense-for-use-search-params.test.js
import { test, describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/require-suspense-for-use-search-params.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('require-suspense-for-use-search-params rule', () => {

  test('valid cases - no useSearchParams', () => {
    ruleTester.run('require-suspense-for-use-search-params', rule, {
      valid: [
        // Component without useSearchParams
        {
          code: `
export default function Page() {
  return <div>Hello</div>;
}`,
        },

        // Component importing but not using useSearchParams
        {
          code: `
import { useSearchParams } from 'next/navigation';

export default function Page() {
  return <div>Hello</div>;
}`,
        },

        // Named export using useSearchParams (not page component)
        {
          code: `
import { useSearchParams } from 'next/navigation';

export function SearchComponent() {
  const searchParams = useSearchParams();
  return <div>{searchParams.get('q')}</div>;
}`,
        },

        // Multiple components, only named exports use useSearchParams
        {
          code: `
import { useSearchParams } from 'next/navigation';

export function SearchComponent() {
  const searchParams = useSearchParams();
  return <div>{searchParams.get('q')}</div>;
}

export default function Page() {
  return <div>Hello</div>;
}`,
        },
      ],

      invalid: [],
    });
  });

  test('complex scenarios', () => {
    ruleTester.run('require-suspense-for-use-search-params', rule, {
      valid: [
        // Higher-order component with Suspense
        {
          code: `
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const withSearchParams = (Component) => {
  return function WrappedComponent(props) {
    const searchParams = useSearchParams();
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Component {...props} searchParams={searchParams} />
      </Suspense>
    );
  };
};

function PageContent({ searchParams }) {
  return <div>{searchParams.get('q')}</div>;
}

export default withSearchParams(PageContent);`,
        },

        // Render prop pattern with Suspense
        {
          code: `
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SearchParamsProvider({ children }) {
  const searchParams = useSearchParams();
  return children(searchParams);
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchParamsProvider>
        {(searchParams) => <div>{searchParams.get('q')}</div>}
      </SearchParamsProvider>
    </Suspense>
  );
}`,
        },
      ],

      invalid: [
        // Async component without Suspense (Next.js 13+ pattern)
        {
          code: `
import { useSearchParams } from 'next/navigation';

export default async function Page() {
  const searchParams = useSearchParams();
  const data = await fetch(\`/api/search?q=\${searchParams.get('q')}\`);
  
  return <div>{JSON.stringify(data)}</div>;
}`,
          errors: [{ messageId: 'missingSuspenseBoundary' }],
        },
        // Complex nested structure without proper Suspense
        {
          code: `
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function Page() {
  const searchParams = useSearchParams();
  
  return (
    <div>
      <header>
        <h1>Search Results for: {searchParams.get('q')}</h1>
      </header>
      <main>
        <Suspense fallback={<div>Loading results...</div>}>
          <div>Search results here...</div>
        </Suspense>
      </main>
      <footer>
        <div>Page {searchParams.get('page')}</div>
      </footer>
    </div>
  );
}`,
          errors: [{ messageId: 'missingSuspenseBoundary' }],
        },
      ],
    });
  });
});