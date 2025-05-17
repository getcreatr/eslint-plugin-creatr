import { test, describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-browser-globals-in-ssr.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-browser-globals-in-ssr rule', () => {
  test('basic cases', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Empty file
        {
          code: '',
        },
        // No browser globals
        {
          code: `
export default function Component() {
  return <div>Hello World</div>;
}`,
        },
        // Using browser globals in useEffect (allowed by default)
        {
          code: `
import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    console.log(window.location.href);
    document.title = 'New Title';
    localStorage.setItem('key', 'value');
  }, []);
  
  return <div>Component</div>;
}`,
        },
        // Using browser globals in event handlers (allowed by default)
        {
          code: `
export default function Component() {
  return (
    <div>
      <button onClick={() => console.log(window.location)}>Log Location</button>
      <button onClick={() => document.title = 'New Title'}>Change Title</button>
      <button onClick={() => localStorage.setItem('key', 'value')}>Save Data</button>
    </div>
  );
}`,
        },
        // Using browser globals with typeof check (allowed by default)
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined') {
    console.log(window.location.href);
  }
  
  const isClient = typeof document !== 'undefined';
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  
  return <div>Component</div>;
}`,
        },
        // Browser globals as property keys (not references)
        {
          code: `
const config = {
  window: { width: 800, height: 600 },
  document: { title: 'My App' },
  navigator: { userAgent: 'Test' }
};

export default function Component() {
  return <div>{config.window.width}</div>;
}`,
        },
      ],

      invalid: [
        // Direct usage of window
        {
          code: `
export default function Component() {
  const url = window.location.href;
  return <div>{url}</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Direct usage of document
        {
          code: `
export default function Component() {
  document.title = 'New Title';
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Direct usage of localStorage
        {
          code: `
export default function Component() {
  const data = localStorage.getItem('key');
  return <div>{data}</div>;
}`,
          errors: [
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Usage in JSX attribute
        {
          code: `
export default function Component() {
  return <div data-url={window.location.href}>Component</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  // Add new test section for default parameter values
  test('default parameter values', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Default parameter with browser global in client component
        {
          code: `
"use client";

export function Component({
  url = window.location.href
}) {
  return <div>{url}</div>;
}`,
          options: [{ allowInClientComponents: true }],
        },
        // Default parameter in object with browser global in client component
        {
          code: `
"use client";

export function SocialShare({
  title = 'Check out this amazing content!',
  description = 'I found this interesting content that I wanted to share with you.',
  url = window.location.href,
  image,
  onShare
}) {
  return <div>{url}</div>;
}`,
          options: [{ allowInClientComponents: true }],
        },
        // Default parameter with typeof check
        {
          code: `
export function Component({
  url = typeof window !== 'undefined' ? window.location.href : ''
}) {
  return <div>{url}</div>;
}`,
        },
      ],

      invalid: [
        // Default parameter with browser global in non-client component
        {
          code: `
export function Component({
  url = window.location.href
}) {
  return <div>{url}</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Default parameter in object with browser global in non-client component
        {
          code: `
export function SocialShare({
  title = 'Check out this amazing content!',
  description = 'I found this interesting content that I wanted to share with you.',
  url = window.location.href,
  image,
  onShare
}) {
  return <div>{url}</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Client component but allowInClientComponents disabled
        {
          code: `
"use client";

export function Component({
  url = window.location.href
}) {
  return <div>{url}</div>;
}`,
          options: [{ allowInClientComponents: false }],
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('JSX attribute expressions', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // In event handler attributes
        {
          code: `
export default function Component() {
  return (
    <form action={() => window.location.href}>
      <button onClick={() => window.open('url')}>Open</button>
    </form>
  );
}`,
        },
      ],

      invalid: [
        // In non-event handler attributes
        {
          code: `
export default function Component() {
  return <input value={window.location.search} />;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // In template literals within JSX attributes
        {
          code: `
export default function Component() {
  return <a href={\`\${window.location.origin}/path\`}>Link</a>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // In complex expressions within JSX attributes
        {
          code: `
export default function Component() {
  return <div className={document.body.classList.contains('dark') ? 'dark-mode' : 'light-mode'}>Content</div>;
}`,
          errors: [
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Real-world case from AuthForm component
        {
          code: `
import { Auth } from "@supabase/auth-ui-react";

export default function AuthForm() {
  return (
    <Auth
      redirectTo={\`\${window.location.origin}/auth/callback\`}
    />
  );
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('client components', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // With "use client" and allowInClientComponents enabled
        {
          code: `
"use client";

export default function Component() {
  const url = window.location.href;
  return <div>{url}</div>;
}`,
          options: [{ allowInClientComponents: true }],
        },
      ],

      invalid: [
        // With "use client" but allowInClientComponents disabled (default)
        {
          code: `
"use client";

export default function Component() {
  const url = window.location.href;
  return <div>{url}</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Without "use client"
        {
          code: `
export default function Component() {
  const url = window.location.href;
  return <div>{url}</div>;
}`,
          options: [{ allowInClientComponents: true }],
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('effect hooks', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // In useEffect
        {
          code: `
import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    document.title = 'New Title';
    localStorage.setItem('theme', 'dark');
  }, []);
  
  return <div>Component</div>;
}`,
        },
        // In useLayoutEffect
        {
          code: `
import { useLayoutEffect } from 'react';

export default function Component() {
  useLayoutEffect(() => {
    const rect = document.body.getBoundingClientRect();
    console.log(rect);
  }, []);
  
  return <div>Component</div>;
}`,
        },
      ],

      invalid: [
        // Outside effect hooks
        {
          code: `
import { useEffect } from 'react';

export default function Component() {
  const url = window.location.href; // Error here
  
  useEffect(() => {
    console.log(url); // This is ok since it's using the variable
  }, [url]);
  
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // With allowInEffects disabled
        {
          code: `
import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
  }, []);
  
  return <div>Component</div>;
}`,
          options: [{ allowInEffects: false }],
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('event handlers', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Various event handlers
        {
          code: `
export default function Component() {
  return (
    <div>
      <button onClick={() => window.alert('Hello')}>Alert</button>
      <input onChange={(e) => localStorage.setItem('input', e.target.value)} />
      <form onSubmit={() => document.forms[0].submit()}>
        <button type="submit">Submit</button>
      </form>
      <div onMouseOver={() => console.log(navigator.userAgent)}>Hover</div>
    </div>
  );
}`,
        },
        // Event handler as property
        {
          code: `
export default function Component() {
  const handleClick = () => {
    window.location.href = '/new-page';
  };
  
  return <button onClick={handleClick}>Navigate</button>;
}`,
        },
      ],

      invalid: [
        // Outside event handlers
        {
          code: `
export default function Component() {
  const handleClick = () => {
    console.log('clicked');
  };
  
  window.addEventListener('click', handleClick); // Error here
  
  return <button onClick={handleClick}>Click</button>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // With allowInEventHandlers disabled
        {
          code: `
export default function Component() {
  return <button onClick={() => window.alert('Hello')}>Alert</button>;
}`,
          options: [{ allowInEventHandlers: false }],
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('typeof checks', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Direct typeof check
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined') {
    console.log(window.location);
  }
  
  const hasDocument = typeof document !== 'undefined';
  
  return <div>Component</div>;
}`,
        },
        // In ternary expressions
        {
          code: `
export default function Component() {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const storage = typeof localStorage !== 'undefined' ? localStorage.getItem('key') : null;
  
  return <div>{url}</div>;
}`,
        },
        // Nested checks
        {
          code: `
export default function Component() {
  const data = typeof window !== 'undefined' 
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem('data') : null)
    : null;
  
  return <div>{data}</div>;
}`,
        },
      ],

      invalid: [
        // Without typeof check
        {
          code: `
export default function Component() {
  if (window) {
    console.log(window.location);
  }
  
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // With allowWithTypeCheck disabled
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined') {
    console.log(window.location);
  }
  
  return <div>Component</div>;
}`,
          options: [{ allowWithTypeCheck: false }],
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('edge cases', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Browser global as function parameter
        {
          code: `
export default function Component() {
  function log(window) {
    console.log(window);
  }
  
  return <div>Component</div>;
}`,
        },
        // Browser global as variable declaration
        {
          code: `
export default function Component() {
  const window = { location: { href: 'test' } };
  console.log(window.location.href);
  
  return <div>Component</div>;
}`,
        },
        // Browser global as destructured property
        {
          code: `
export default function Component({ window }) {
  return <div>{window}</div>;
}`,
        },
      ],

      invalid: [
        // Multiple browser globals in one statement
        {
          code: `
export default function Component() {
  const data = {
    url: window.location.href,
    title: document.title,
    storage: localStorage.getItem('key')
  };
  
  return <div>{data.url}</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // In function call arguments
        {
          code: `
export default function Component() {
  const result = someFunction(window.location.href, document.title);
  
  return <div>{result}</div>;
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('complex scenarios', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Complex valid component
        {
          code: `
import { useState, useEffect } from 'react';

export default function ComplexComponent() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Browser globals are OK in useEffect
    const handleScroll = () => {
      console.log(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    document.title = 'Complex Component';
    
    // Fetch data from localStorage
    const savedData = localStorage.getItem('data');
    if (savedData) {
      setData(JSON.parse(savedData));
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Browser globals are OK in event handlers
  const handleClick = () => {
    window.location.href = '/new-page';
  };
  
  // Browser globals are OK with typeof check
  const isClient = typeof window !== 'undefined';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  
  return (
    <div>
      <h1>{data?.title || 'Loading...'}</h1>
      <p>User Agent: {userAgent}</p>
      <button onClick={handleClick}>Navigate</button>
      <button onClick={() => localStorage.setItem('visited', 'true')}>
        Mark as Visited
      </button>
    </div>
  );
}`,
        },
      ],

      invalid: [
        // Complex invalid component
        {
          code: `
import { useState, useEffect } from 'react';

export default function ComplexComponent() {
  // Error: using window outside allowed contexts
  const initialUrl = window.location.href;
  const [data, setData] = useState(null);
  
  // Error: using document outside allowed contexts
  document.title = 'Complex Component';
  
  useEffect(() => {
    // This is OK
    const savedData = localStorage.getItem('data');
    if (savedData) {
      setData(JSON.parse(savedData));
    }
  }, []);
  
  // Error: using navigator outside allowed contexts
  const userAgent = navigator.userAgent;
  
  return (
    <div>
      <h1>{data?.title || 'Loading...'}</h1>
      <p>User Agent: {userAgent}</p>
      <p>URL: {initialUrl}</p>
      {/* Error: using window in JSX attribute */}
      <a href={\`\${window.location.origin}/home\`}>Home</a>
    </div>
  );
}`,
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'navigator\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  test('custom options', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Additional custom globals allowed with typeof check
        {
          code: `
export default function Component() {
  if (typeof customGlobal !== 'undefined') {
    console.log(customGlobal.data);
  }
  
  return <div>Component</div>;
}`,
          options: [{ additionalGlobals: ['customGlobal'] }],
        },
      ],

      invalid: [
        // Additional custom globals without proper checks
        {
          code: `
export default function Component() {
  const data = customGlobal.getData();
  
  return <div>{data}</div>;
}`,
          options: [{ additionalGlobals: ['customGlobal'] }],
          errors: [
            {
              message: '\'customGlobal\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // All options disabled
        {
          code: `
"use client";
import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    console.log(window.location); // Error even in useEffect
  }, []);
  
  if (typeof document !== 'undefined') {
    console.log(document.title); // Error even with typeof check
  }
  
  return (
    <button onClick={() => localStorage.setItem('key', 'value')}>
      Save {/* Error even in event handler */}
    </button>
  );
}`,
          options: [{
            allowInClientComponents: false,
            allowInEffects: false,
            allowInEventHandlers: false,
            allowWithTypeCheck: false,
          }],
          errors: [
            {
              message: '\'window\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });

  // Test cases for combined type checks in the no-browser-globals-in-ssr rule

  test('combined type checks', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Combined window and document check
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', 'https://example.com');
    linkElement.click();
  }
  return <div>Component</div>;
}`,
        },
        // Combined check with multiple browser globals
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    window.localStorage.setItem('key', 'value');
    console.log(window.location.href);
  }
  return <div>Component</div>;
}`,
        },
        // Combined check with OR operator
        {
          code: `
export default function Component() {
  const isBrowser = typeof window !== 'undefined' || typeof document !== 'undefined';
  if (isBrowser && typeof document !== 'undefined') {
    document.title = 'Title';
  }
  return <div>Component</div>;
}`,
        },
        // Combined check in ternary
        {
          code: `
export default function Component() {
  const element = typeof window !== 'undefined' && typeof document !== 'undefined' 
    ? document.createElement('div') 
    : null;
  return <div>{element}</div>;
}`,
        },
        // Real-world case: export functionality with combined check
        {
          code: `
export default function Component() {
  const exportData = () => {
    const data = "content-to-export";
    const dataUri = \`data:text/plain;charset=utf-8,\${encodeURIComponent(data)}\`;
    
    // Combined check before using document
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', 'export.txt');
      linkElement.click();
    }
  };
  
  return <button onClick={exportData}>Export</button>;
}`,
        },
        // Nested checks
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined') {
    if (typeof document !== 'undefined') {
      document.title = 'Title';
    }
    window.addEventListener('resize', () => {});
  }
  return <div>Component</div>;
}`,
        },
        // Real-world FeedbackOrchestrator case
        {
          code: `
export default function Component() {
  const exportAnalysis = () => {
    const dataStr = JSON.stringify({});
    const dataUri = \`data:application/json;charset=utf-8,\${encodeURIComponent(dataStr)}\`;
    const exportFileName = 'export.json';
    
    // Check if we're in a browser environment before using document
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
    }
  };
  
  return <button onClick={exportAnalysis}>Export Analysis</button>;
}`,
        },
      ],
      invalid: [
        // Missing check for document
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined') {
    const linkElement = document.createElement('a'); // Error: missing check for document
    linkElement.click();
  }
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'document\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Incomplete combined check
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined' && navigator) { // Error: missing proper check for navigator
    console.log(navigator.userAgent);
  }
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'navigator\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
            {
              message: '\'navigator\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Multiple globals with incomplete checks
        {
          code: `
export default function Component() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.title = 'Safe';
    localStorage.setItem('key', 'value'); // Error: missing check for localStorage
  }
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });
  // Add new test section for browser check variables
  test('browser check variables', () => {
    ruleTester.run('no-browser-globals-in-ssr', rule, {
      valid: [
        // Using browser check variable with localStorage
        {
          code: `
export default function Component() {
  const isBrowser = typeof window !== 'undefined';
  
  if (isBrowser) {
    localStorage.setItem('key', 'value');
  }
  
  return <div>Component</div>;
}`,
        },
        // Using browser check variable with multiple globals
        {
          code: `
export default function Component() {
  const isClient = typeof window !== 'undefined';
  
  const handleClick = () => {
    if (isClient) {
      window.location.href = '/new-page';
      document.title = 'New Page';
    }
  };
  
  return <button onClick={handleClick}>Navigate</button>;
}`,
        },
        // Browser check variable with different names
        {
          code: `
export default function Component() {
  const isClient = typeof window !== 'undefined';
  const runningInBrowser = isClient; // Variable assigned from another browser check variable
  
  if (runningInBrowser) {
    document.title = window.location.href;
  }
  
  return <div>Component</div>;
}`,
        },
        // With try/catch block
        {
          code: `
export default function Component() {
  const isBrowser = typeof window !== 'undefined';
  
  const handleClick = () => {
    if (isBrowser) {
      try {
        localStorage.setItem('key', 'value');
      } catch (error) {
        console.error('Error saving to localStorage', error);
      }
    }
  };
  
  return <button onClick={handleClick}>Save</button>;
}`,
        },
        // Real-world AuthProvider pattern with explicit test case
        {
          code: `
'use client';
import { createContext, useContext, useState } from 'react';

export function AuthProvider({ children }) {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    document.title = window.location.href; // This should be allowed with the isBrowser check
  }

  const login = (email, password) => {
    if (isBrowser) {
      localStorage.setItem('user', JSON.stringify({ email }));
    }
  };

  const logout = () => {
    if (isBrowser) {
      localStorage.removeItem('user');
    }
  };

  return <div>{children}</div>;
}`,
          options: [{ allowInClientComponents: true }],
        },
      ],
      invalid: [
        // Using browser global without checking the variable
        {
          code: `
export default function Component() {
  const isBrowser = typeof window !== 'undefined';
  
  // Not using the check variable
  localStorage.setItem('key', 'value');
  
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Check variable in wrong scope
        {
          code: `
export default function Component() {
  const renderContent = () => {
    const isBrowser = typeof window !== 'undefined';
    return <div>Content</div>;
  };
  
  // isBrowser not in scope here
  if (true) {
    localStorage.setItem('key', 'value');
  }
  
  return renderContent();
}`,
          errors: [
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
        // Variable that's not a browser check
        {
          code: `
export default function Component() {
  const isBrowser = true;
  
  if (isBrowser) {
    localStorage.setItem('key', 'value');
  }
  
  return <div>Component</div>;
}`,
          errors: [
            {
              message: '\'localStorage\' is not available during server-side rendering. Consider moving this to useEffect, an event handler, or wrap with a typeof check.',
            },
          ],
        },
      ],
    });
  });
});