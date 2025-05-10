# eslint-plugin-creatr

Custom ESLint rules for Next.js projects by Creatr.

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```bash
bun install eslint --save-dev
```

Next, install `eslint-plugin-creatr`:

```bash
bun install eslint-plugin-creatr --save-dev
```

## Usage

Add `creatr` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
  "plugins": ["creatr"]
}
```

Then configure the rules you want to use under the rules section.

```json
{
  "rules": {
    "creatr/require-use-client": "error"
  }
}
```

Or use the recommended configuration:

```json
{
  "extends": ["plugin:creatr/recommended"]
}
```

For Next.js App Router projects:

```json
{
  "extends": ["plugin:creatr/nextjs-app-router"]
}
```

## Supported Rules

- `require-use-client` - Require "use client" directive when using client-side features

## Configurations

- `recommended` - Basic configuration with essential rules
- `nextjs-app-router` - Configuration optimized for Next.js App Router

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-rule`)
3. Commit your changes (`git commit -m 'Add some amazing rule'`)
4. Push to the branch (`git push origin feature/amazing-rule`)
5. Open a Pull Request

## License

MIT