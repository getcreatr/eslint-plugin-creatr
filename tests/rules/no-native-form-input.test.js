import { describe } from 'bun:test';
import { RuleTester } from 'eslint';
import rule from '../../lib/rules/no-native-form-input.js';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

const APP = '/repo/src/features/x/components/thing.tsx';

describe('no-native-form-input rule', () => {
  ruleTester.run('no-native-form-input', rule, {
    valid: [
      // ── Ordinary types are untouched ────────────────────────────────────
      {
        filename: APP,
        code: 'const A = () => <Input type="text" />;',
      },
      {
        filename: APP,
        code: 'const A = () => <Input type="email" />;',
      },
      {
        filename: APP,
        code: 'const A = () => <input type="checkbox" />;',
      },
      // No type attribute at all — nothing to judge
      {
        filename: APP,
        code: 'const A = (props) => <Input {...props} />;',
      },
      // Dynamic type cannot be classified — not an excuse elsewhere, but here
      // it genuinely cannot be judged statically
      {
        filename: APP,
        code: 'const A = ({ t }) => <Input type={t} />;',
      },
      // Not a checked element name
      {
        filename: APP,
        code: 'const A = () => <DateField type="date" />;',
      },

      // ── Silenced by a reason comment ────────────────────────────────────
      {
        filename: APP,
        code: `const A = ({ v, onChange }) => (
          <div>
            {/* field-reason: internal debug tool, never shown to end users */}
            <Input type="date" value={v} onChange={onChange} />
          </div>
        );`,
      },
      {
        filename: APP,
        code: `const A = ({ v, onChange }) => (
          <div>
            {/* field-reason: legacy admin export form kept for parity with old CSV tool */}
            <input type="color" value={v} onChange={onChange} />
          </div>
        );`,
      },
      // Custom marker + relaxed length via options
      {
        filename: APP,
        code: `const A = ({ v }) => (
          <div>
            {/* native-ok: legacy */}
            <Input type="date" value={v} />
          </div>
        );`,
        options: [{ marker: 'native-ok:', minReasonLength: 5 }],
      },
      // elementNames restricted — a custom wrapper is not checked by default config
      {
        filename: APP,
        code: 'const A = () => <MyLegacyInput type="date" />;',
        options: [{ elementNames: ['input'] }],
      },
    ],

    invalid: [
      // ── The real defects from everspark-tasks-6cv1b3 ────────────────────
      // team-time-filter-bar.tsx:70 — shadcn Input wrapper with type="date"
      {
        filename: APP,
        code: 'const A = ({ v, onChange }) => <Input type="date" value={v} onChange={onChange} />;',
        errors: [{ messageId: 'nativeInput' }],
      },
      // requested-deadline-input.tsx:46
      {
        filename: APP,
        code: 'const A = ({ v }) => <Input id="deadline" type="date" value={v} className="w-40" />;',
        errors: [{ messageId: 'nativeInput' }],
      },
      // Truly native <input>, not the shadcn wrapper
      {
        filename: APP,
        code: 'const A = ({ v, onChange }) => <input type="color" value={v} onChange={onChange} />;',
        errors: [{ messageId: 'nativeInput' }],
      },
      {
        filename: APP,
        code: 'const A = () => <Input type="time" />;',
        errors: [{ messageId: 'nativeInput' }],
      },
      {
        filename: APP,
        code: 'const A = () => <Input type="datetime-local" />;',
        errors: [{ messageId: 'nativeInput' }],
      },
      {
        filename: APP,
        code: 'const A = () => <Input type="tel" />;',
        errors: [{ messageId: 'nativeInput' }],
      },

      // ── Stub annotations are called out specifically ────────────────────
      {
        filename: APP,
        code: `const A = ({ v }) => (
          <div>
            {/* field-reason: legacy */}
            <Input type="date" value={v} />
          </div>
        );`,
        errors: [
          {
            messageId: 'reasonTooShort',
            data: { marker: 'field-reason:', min: '20', reason: 'legacy' },
          },
        ],
      },

      // ── A comment BELOW the tag does not count ──────────────────────────
      {
        filename: APP,
        code: `const A = ({ v }) => (
          <div>
            <Input type="date" value={v} />
            {/* field-reason: this is underneath and therefore does not apply to it */}
          </div>
        );`,
        errors: [{ messageId: 'nativeInput' }],
      },

      // ── A marker on a DIFFERENT element does not leak to the next one ───
      {
        filename: APP,
        code: `const A = ({ a, b }) => (
          <div>
            {/* field-reason: first one is a legacy internal-only debug field */}
            <Input type="date" value={a} />
            <Input type="color" value={b} />
          </div>
        );`,
        errors: [{ messageId: 'nativeInput' }],
      },
    ],
  });
});
