import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-event-handlers-in-server-components.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('no-event-handlers-in-server-components rule', () => {
  ruleTester.run('no-event-handlers-in-server-components', rule, {
    valid: [
      // Client component with standard event handlers
      {
        code: `"use client";
export default function Button() {
  return <button onClick={() => console.log('clicked')}>Click me</button>
}`,
      },
      // Client component with single quotes
      {
        code: `'use client';
export default function Button() {
  return <button onClick={() => console.log('clicked')}>Click me</button>
}`,
      },
      // Server component without event handlers
      {
        code: `export default function ServerComponent() {
  return <div className="server">Static content</div>
}`,
      },
      // Server component with regular props
      {
        code: `export default function Card({ title, content, onlyShow }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{content}</p>
    </div>
  )
}`,
      },
      // Props that look like event handlers but aren't
      {
        code: `export default function Component() {
  return <div onlyShow={true} oncePerDay={false}>Content</div>
}`,
      },
      // Server component with data attributes
      {
        code: `export default function Component() {
  return <div data-onclick="handler">Content</div>
}`,
      },
      // Use client with extra whitespace
      {
        code: `"use client"  ;
export default function Button() {
  return <button onClick={() => {}}>Click</button>
}`,
      },
      // Use client with backticks
      {
        code: `\`use client\`;
export default function Button() {
  return <button onClick={() => {}}>Click</button>
}`,
      },
      // Event handler in spread props - LIMITATION: not detected by static analysis
      {
        code: `export default function Component() {
  const props = { onClick: () => {} };
  return <button {...props}>Button</button>
}`,
      },
      // Direct spread with event handler - LIMITATION: not detected by static analysis
      {
        code: `export default function Component() {
  return <button {...{ onClick: () => {} }}>Button</button>
}`,
      },
      // Computed property names - LIMITATION: not detected by static analysis
      {
        code: `export default function Component() {
  const handlerName = 'onClick';
  return <button {...{ [handlerName]: () => {} }}>Button</button>
}`,
      },
      // Spread from function result - LIMITATION: not detected by static analysis
      {
        code: `export default function Component() {
  const getProps = () => ({ onClick: () => {} });
  return <button {...getProps()}>Button</button>
}`,
      },
      // Allow specific event handlers
      {
        code: `export default function Component() {
  return <div onLoad={() => {}} onError={() => {}}>Content</div>
}`,
        options: [{ allowedEventHandlers: ['onLoad', 'onError'] }],
      },
      // Don't check custom components
      {
        code: `import CustomButton from './CustomButton'

export default function Page() {
  return <CustomButton onClick={() => {}} />
}`,
        options: [{ checkCustomComponents: false }],
      },
    ],
    invalid: [
      // Simple onClick handler
      {
        code: `export default function Button() {
  return <button onClick={() => console.log('clicked')}>Click me</button>
}`,
        errors: [
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Multiple event handlers
      {
        code: `export default function Form() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <input onChange={(e) => console.log(e.target.value)} />
      <button onClick={() => alert('clicked')}>Submit</button>
    </form>
  )
}`,
        errors: [
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onSubmit' }
          },
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onChange' }
          },
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // DOM event handlers
      {
        code: `export default function Component() {
  return (
    <div
      onClick={() => {}}
      onMouseOver={() => {}}
      onKeyDown={() => {}}
      onFocus={() => {}}
      onBlur={() => {}}
      onScroll={() => {}}
      onDragStart={() => {}}
      onTouchStart={() => {}}
    >
      Content
    </div>
  )
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onMouseOver' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onKeyDown' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onFocus' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onBlur' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onScroll' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onDragStart' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onTouchStart' } },
        ],
      },
      // Custom event handlers
      {
        code: `export default function Component() {
  return <CustomComponent onCustomEvent={() => {}} onSpecialAction={() => {}} />
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onCustomEvent' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onSpecialAction' } },
        ],
      },
      // Function reference
      {
        code: `export default function Component() {
  const handleClick = () => console.log('clicked');
  return <button onClick={handleClick}>Button</button>
}`,
        errors: [
          {
            messageId: 'noEventHandlerInServer',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Method call
      {
        code: `export default function Component() {
  const obj = { method: () => {} };
  return <button onClick={obj.method}>Button</button>
}`,
        errors: [
          {
            messageId: 'noEventHandlerInServer',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Bound function
      {
        code: `export default function Component() {
  const handler = () => {};
  return <button onClick={handler.bind(this)}>Button</button>
}`,
        errors: [
          {
            messageId: 'noEventHandlerInServer',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Function expression
      {
        code: `export default function Component() {
  return <button onClick={function() { console.log('clicked') }}>Button</button>
}`,
        errors: [
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Use client not at the top
      {
        code: `import React from 'react';
"use client";
export default function Button() {
  return <button onClick={() => {}}>Click</button>
}`,
        errors: [
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Use client in wrong format
      {
        code: `"use-client";
export default function Button() {
  return <button onClick={() => {}}>Click</button>
}`,
        errors: [
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Use client as comment
      {
        code: `// "use client"
export default function Button() {
  return <button onClick={() => {}}>Click</button>
}`,
        errors: [
          {
            messageId: 'noInlineEventHandler',
            data: { eventHandler: 'onClick' }
          },
        ],
      },
      // Nested components
      {
        code: `export default function Component() {
  return (
    <div>
      <header>
        <button onClick={() => {}}>Click</button>
      </header>
      <main>
        <form onSubmit={() => {}}>
          <input onChange={() => {}} />
        </form>
      </main>
    </div>
  )
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onSubmit' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onChange' } },
        ],
      },
      // Fragment syntax
      {
        code: `export default function Component() {
  return (
    <>
      <button onClick={() => {}}>Button 1</button>
      <button onClick={() => {}}>Button 2</button>
    </>
  )
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
      // Conditional rendering
      {
        code: `export default function Component({ show }) {
  return show ? (
    <button onClick={() => {}}>Shown</button>
  ) : (
    <button onClick={() => {}}>Hidden</button>
  )
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
      // Map with event handlers
      {
        code: `export default function Component({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => console.log(item)}>
          {item.name}
        </li>
      ))}
    </ul>
  )
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
      // Only allowed specific handlers
      {
        code: `export default function Component() {
  return <div onLoad={() => {}} onClick={() => {}}>Content</div>
}`,
        options: [{ allowedEventHandlers: ['onLoad'] }],
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
      // Still check HTML elements when custom components disabled
      {
        code: `export default function Component() {
  return <button onClick={() => {}}>Click</button>
}`,
        options: [{ checkCustomComponents: false }],
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
      // Your original NotFound component
      {
        code: `import React from "react"
import Link from "next/link"
import { ArrowLeft, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <Link
          href="/"
          className="inline-flex items-center"
        >
          <Home className="mr-2 h-5 w-5" />
          Go Home
        </Link>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Go Back
        </button>
      </div>
    </div>
  )
}`,
        errors: [
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
      // Complex form component
      {
        code: `export default function ContactForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
    // submit logic
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <input
        type="email"
        onChange={(e) => console.log(e.target.value)}
        onBlur={(e) => validateEmail(e.target.value)}
      />
      <textarea
        onChange={(e) => console.log(e.target.value)}
        onFocus={() => clearError()}
      />
      <button
        type="submit"
        onClick={(e) => {
          if (!isValid) e.preventDefault();
        }}
      >
        Submit
      </button>
    </form>
  )
}`,
        errors: [
          { messageId: 'noEventHandlerInServer', data: { eventHandler: 'onSubmit' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onChange' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onBlur' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onChange' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onFocus' } },
          { messageId: 'noInlineEventHandler', data: { eventHandler: 'onClick' } },
        ],
      },
    ],
  });
});
