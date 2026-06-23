# require-server-action-metadata

Require `.metadata({ actionName: '<exportName>' })` on every `next-safe-action`
server action.

## Rationale

Server actions are wrapped by the `next-safe-action` clients (`action` /
`authedAction`), whose `.use(...)` middleware opens a `server_action.<actionName>`
span for observability. For that span to be named, every action must pass
`.metadata({ actionName: '...' })`.

TypeScript already makes `.metadata()` mandatory when the client defines a
`defineMetadataSchema` (a miss fails `tsc` with TS2684), but this rule adds:

1. **Instant in-editor feedback** the moment an action is written.
2. An **autofix** that inserts the call (TypeScript can't autofix).
3. Enforcement that **`actionName` equals the export name**, so span names stay
   aligned with the function (TypeScript can't check the string value).

## What it flags

A `.action(fn)` call whose chain base is a tracked safe-action client — an
imported `action` / `authedAction` (from `@/lib/safe-action` by default) or a
local derivation such as `const adminAction = authedAction.use(...)`.

### ❌ Incorrect

```ts
import { authedAction } from '@/lib/safe-action';

export const createTicket = authedAction
  .schema(CreateTicketSchema)
  .action(async ({ parsedInput }) => { /* ... */ }); // missing .metadata()
```

```ts
export const createTicket = authedAction
  .metadata({ actionName: 'makeTicket' }) // actionName ≠ export name
  .schema(CreateTicketSchema)
  .action(async () => {});
```

### ✅ Correct

```ts
import { authedAction } from '@/lib/safe-action';

export const createTicket = authedAction
  .metadata({ actionName: 'createTicket' })
  .schema(CreateTicketSchema)
  .action(async ({ parsedInput }) => { /* ... */ });
```

`eslint --fix` inserts the missing `.metadata({ actionName: '<exportName>' })`
(or corrects a wrong `actionName`) automatically.

## Options

```jsonc
["error", {
  // Imported safe-action client identifiers to track.
  "clients": ["action", "authedAction"],
  // The module the clients are imported from.
  "module": "@/lib/safe-action",
  // Also require actionName to equal the enclosing `export const <name>`.
  "enforceActionName": true
}]
```

## Notes

- Anonymous/inline actions with no resolvable `export const <name>` are reported
  but not auto-fixed (the developer names them).
- `.action()` calls on objects that are not tracked safe-action clients are
  ignored.
