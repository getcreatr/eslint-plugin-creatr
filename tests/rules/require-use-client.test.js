// tests/rules/require-use-client.test.js
import { test, describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/require-use-client.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('require-use-client rule', () => {
  test('basic cases', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // File with "use client" directive
        {
          code: `"use client";
import { motion } from 'framer-motion';

export default function Component() {
  return <motion.div />;
}`,
        },
        // File without client-side features
        {
          code: `import Link from 'next/link';

export default function Component() {
  return <Link href="/">Home</Link>;
}`,
        },
        // Empty file
        {
          code: '',
        },
        // Server component with no hooks
        {
          code: `export default function ServerComponent({ data }) {
  return <div>{data.title}</div>;
}`,
        },
        // File with "use client" and multiple client features
        {
          code: `"use client";
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <motion.div onClick={() => setCount(count + 1)}>{count}</motion.div>;
}`,
        },
      ],

      invalid: [
        // Missing "use client" with framer-motion
        {
          code: `import { motion } from 'framer-motion';

export default function Component() {
  return <motion.div />;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "framer-motion"' },
            },
          ],
          output: `"use client";

import { motion } from 'framer-motion';

export default function Component() {
  return <motion.div />;
}`,
        },
      ],
    });
  });

  test('React hooks', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // With "use client" and hooks
        {
          code: `"use client";
import { useState, useEffect } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log(count);
  }, [count]);
  return <div>{count}</div>;
}`,
        },
      ],

      invalid: [
        // Missing "use client" with useState
        {
          code: `import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses React hook "useState"' },
            },
          ],
          output: `"use client";

import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`,
        },
        // Missing "use client" with useEffect
        {
          code: `import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    console.log('mounted');
  }, []);
  return <div>Component</div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses React hook "useEffect"' },
            },
          ],
          output: `"use client";

import { useEffect } from 'react';

export default function Component() {
  useEffect(() => {
    console.log('mounted');
  }, []);
  return <div>Component</div>;
}`,
        },
        // Missing "use client" with multiple hooks
        {
          code: `import { useState, useEffect, useCallback } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log(count);
  }, [count]);
  
  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);
  
  return <div onClick={increment}>{count}</div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses React hook "useState"' },
            },
          ],
          output: `"use client";

import { useState, useEffect, useCallback } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log(count);
  }, [count]);
  
  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);
  
  return <div onClick={increment}>{count}</div>;
}`,
        },
      ],
    });
  });

  test('event handlers', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // With "use client" and event handlers
        {
          code: `"use client";

export default function Component() {
  return <button onClick={() => console.log('clicked')}>Click</button>;
}`,
        },
      ],

      invalid: [
        // Missing "use client" with onClick
        {
          code: `export default function Component() {
  return <button onClick={() => console.log('clicked')}>Click</button>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses event handler "onClick"' },
            },
          ],
          output: `"use client";

export default function Component() {
  return <button onClick={() => console.log('clicked')}>Click</button>;
}`,
        },
        // Missing "use client" with onChange
        {
          code: `export default function Component() {
  return <input onChange={(e) => console.log(e.target.value)} />;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses event handler "onChange"' },
            },
          ],
          output: `"use client";

export default function Component() {
  return <input onChange={(e) => console.log(e.target.value)} />;
}`,
        },
        // Missing "use client" with onSubmit
        {
          code: `export default function Component() {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      console.log('submitted');
    }}>
      <button type="submit">Submit</button>
    </form>
  );
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses event handler "onSubmit"' },
            },
          ],
          output: `"use client";

export default function Component() {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      console.log('submitted');
    }}>
      <button type="submit">Submit</button>
    </form>
  );
}`,
        },
      ],
    });
  });

  test('client-side libraries', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // With "use client" and various client libraries
        {
          code: `"use client";
import { motion } from 'framer-motion';
import { useSpring } from 'react-spring';
import { useQuery } from '@tanstack/react-query';

export default function Component() {
  return <div>Component</div>;
}`,
        },
      ],

      invalid: [
        // Missing "use client" with react-spring
        {
          code: `import { useSpring } from 'react-spring';

export default function Component() {
  const props = useSpring({ opacity: 1 });
  return <div style={props}>Component</div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "react-spring"' },
            },
          ],
          output: `"use client";

import { useSpring } from 'react-spring';

export default function Component() {
  const props = useSpring({ opacity: 1 });
  return <div style={props}>Component</div>;
}`,
        },
        // Missing "use client" with @tanstack/react-query
        {
          code: `import { useQuery } from '@tanstack/react-query';

export default function Component() {
  const { data } = useQuery(['key'], fetchData);
  return <div>{data}</div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "@tanstack/react-query"' },
            },
          ],
          output: `"use client";

import { useQuery } from '@tanstack/react-query';

export default function Component() {
  const { data } = useQuery(['key'], fetchData);
  return <div>{data}</div>;
}`,
        },
        // Missing "use client" with recharts
        {
          code: `import { LineChart, Line, XAxis, YAxis } from 'recharts';

export default function Chart({ data }) {
  return (
    <LineChart width={600} height={300} data={data}>
      <Line type="monotone" dataKey="value" stroke="#8884d8" />
      <XAxis dataKey="name" />
      <YAxis />
    </LineChart>
  );
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "recharts"' },
            },
          ],
          output: `"use client";

import { LineChart, Line, XAxis, YAxis } from 'recharts';

export default function Chart({ data }) {
  return (
    <LineChart width={600} height={300} data={data}>
      <Line type="monotone" dataKey="value" stroke="#8884d8" />
      <XAxis dataKey="name" />
      <YAxis />
    </LineChart>
  );
}`,
        },
      ],
    });
  });

  test('custom configurations', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // Custom library with "use client"
        {
          code: `"use client";
import { CustomComponent } from 'my-custom-library';

export default function Component() {
  return <CustomComponent />;
}`,
          options: [{ libraries: ['my-custom-library'] }],
        },
        // Custom hook with "use client"
        {
          code: `"use client";

export default function Component() {
  useMyCustomHook();
  return <div>Component</div>;
}`,
          options: [{ hooks: ['useMyCustomHook'] }],
        },
        // Event handlers disabled
        {
          code: `export default function Component() {
  return <button onClick={() => console.log('clicked')}>Click</button>;
}`,
          options: [{ checkEventHandlers: false }],
        },
      ],

      invalid: [
        // Missing "use client" with custom library
        {
          code: `import { CustomComponent } from 'my-custom-library';

export default function Component() {
  return <CustomComponent />;
}`,
          options: [{ libraries: ['my-custom-library'] }],
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "my-custom-library"' },
            },
          ],
          output: `"use client";

import { CustomComponent } from 'my-custom-library';

export default function Component() {
  return <CustomComponent />;
}`,
        },
        // Missing "use client" with custom hook
        {
          code: `export default function Component() {
  useMyCustomHook();
  return <div>Component</div>;
}`,
          options: [{ hooks: ['useMyCustomHook'] }],
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses React hook "useMyCustomHook"' },
            },
          ],
          output: `"use client";

export default function Component() {
  useMyCustomHook();
  return <div>Component</div>;
}`,
        },
      ],
    });
  });

  test('edge cases', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // Empty file
        {
          code: '',
        },
        // Only comments
        {
          code: `// This is a comment
/* This is another comment */`,
        },
        // Only imports without client libraries
        {
          code: `import path from 'path';
import fs from 'fs';`,
        },
        // Alternate "use client" format
        {
          code: `'use client';
import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`,
        },
      ],

      invalid: [
        // Multiple violations (should only report first)
        {
          code: `import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <motion.div onClick={() => setCount(count + 1)}>{count}</motion.div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "framer-motion"' },
            },
          ],
          output: `"use client";

import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Component() {
  const [count, setCount] = useState(0);
  return <motion.div onClick={() => setCount(count + 1)}>{count}</motion.div>;
}`,
        },
        // Component with only event handler
        {
          code: `export default function Component() {
  return <div onMouseOver={() => console.log('hover')}>Hover me</div>;
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'uses event handler "onMouseOver"' },
            },
          ],
          output: `"use client";

export default function Component() {
  return <div onMouseOver={() => console.log('hover')}>Hover me</div>;
}`,
        },
      ],
    });
  });

  test('complex scenarios', () => {
    ruleTester.run('require-use-client', rule, {
      valid: [
        // Complex component with "use client"
        {
          code: `"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

export default function ComplexComponent() {
  const [count, setCount] = useState(0);
  const { data, isLoading } = useQuery(['data'], fetchData);
  
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => setCount(count + 1)}
    >
      <h1>{data.title}</h1>
      <p>Count: {count}</p>
    </motion.div>
  );
}`,
        },
      ],

      invalid: [
        // Complex component without "use client"
        {
          code: `import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

export default function ComplexComponent() {
  const [count, setCount] = useState(0);
  const { data, isLoading } = useQuery(['data'], fetchData);
  
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => setCount(count + 1)}
    >
      <h1>{data.title}</h1>
      <p>Count: {count}</p>
    </motion.div>
  );
}`,
          errors: [
            {
              messageId: 'missingUseClient',
              data: { reason: 'imports "framer-motion"' },
            },
          ],
          output: `"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

export default function ComplexComponent() {
  const [count, setCount] = useState(0);
  const { data, isLoading } = useQuery(['data'], fetchData);
  
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => setCount(count + 1)}
    >
      <h1>{data.title}</h1>
      <p>Count: {count}</p>
    </motion.div>
  );
}`,
        },
      ],
    });
  });
});