# Development

## Requirements

- Node.js version from `.node-version` (`>=24 <25`)
- npm for install and scripts; Bun lockfile is checked in CI (`bun.lock`)
- A provider CLI if you want to exercise live chat (Claude Code is the default)
- Obsidian 1.7.2+ desktop, for manual UI checks

## Install and run

From the vault plugins folder or a standalone clone:

```bash
npm install
npm run dev      # CSS + esbuild watch
npm run build    # production CSS + bundle
```

`npm run dev` and `npm run build` both rebuild `styles.css` from `src/style/`.

Optional `.env.local` is loaded by `esbuild.config.mjs` for local overrides.

## Verification

Default full check:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint on `src` and `tests` |
| `npm run test` | Jest unit + integration, then architecture / identity / eslint / version node:test files |
| `npm run test:unit` | Jest only |
| `npm run test:architecture` | Import-boundary check only |
| `npm run test:watch` | Jest watch |
| `npm run test:coverage` | Jest coverage |
| `npm run check:lockfile` | `bun install --frozen-lockfile --ignore-scripts` |
| `npm run check:performance` | Startup budget |

CI (`.github/workflows/ci.yml`) runs lockfile, lint, typecheck, test, then build on `main` and pull requests.

## TDD

For new behavior or bug fixes, work one observable slice at a time:

1. Add or update the failing test in the mirrored `tests/` path.
2. Make the narrowest change that passes.
3. Refactor.

Test through the closest stable owner or public interface. Do not expose private methods only for tests.

Mock environment and provider boundaries. Prefer real Dean code, fixtures, or lightweight fakes for Dean-owned collaborators.

For shared provider contracts, test provider-neutral behavior first, then cover each adapter's distinct behavior.

If a change cannot be tested directly, document why and cover the closest stable contract instead.

## Conventions

- English for code, comments, identifiers, commits, and code blocks.
- No `console.*` in production code.
- Settings writers merge; they do not replace provider-owned configuration.
- No `.ts` extensions on imports. Prefer `@/` aliases over deep relative paths.
- Symbols: no `I` prefix on interfaces. Treat acronyms as words (`SdkSessionReadResult`), except types that mirror an external SDK (`SDKMessage`).
- Files: `PascalCase.ts` after the primary export. `camelCase.ts` only for utility bags. `kebab-case.ts` only to mirror an external package name. Barrels stay `index.ts`. Tests are `<Name>.test.ts`.
- Folders: `kebab-case`.
- CSS: `.dean-` prefix, BEM-lite, Obsidian variables. Register new modules in `src/style/index.css`.
- Non-committed notes, traces, and throwaway scripts go in `.context/`.

## Where to change what

| If you are changing… | Start here |
| --- | --- |
| Plugin load, commands, ribbon | `src/main.ts` |
| Conversation persistence or deletion | `ConversationRepository` via `FeatureHost` |
| Settings transaction / rollback | `SettingsCoordinator` |
| A shared chat behavior | `src/features/chat/` + a core capability or UI config hook |
| A provider-native protocol detail | `src/providers/<id>/` |
| Execution event shape | `src/core/execution/` |
| Model routing or enabled-model policy | `src/core/providers/conversationModel.ts` and `modelSelection.ts` |
| Built-in `/` commands | `src/core/commands/builtInCommands.ts` |
| Visual style | `src/style/` (never root `styles.css`) |
| Copy / translations | `src/i18n/locales/` |
| Import boundaries | `scripts/check-architecture-boundaries.test.mjs` |

Read the scoped `AGENTS.md` in that area before editing. Those files record ownership, invariants, and gotchas that this documentation does not duplicate.

## Product identity

The plugin id, view type, storage directory, and CSS prefix are `dean` / `dean-view` / `.dean/` / `.dean-`. `scripts/check-product-identity.test.mjs` asserts those identities and fails if the retired product name reappears in source or docs (`docs/superpowers/` is excluded).

## Versioning

`npm version` runs `scripts/sync-version.js` so `manifest.json` stays aligned with `package.json`. `versions.json` records Obsidian compatibility for releases.

## Review checklist

Reviews must enforce:

- Dependency direction (see [Architecture](architecture.md))
- Feature vs provider vs core ownership
- Provider-boundary rules (opaque `providerState`, read-only native history, capability gating)
- State-lifetime rules (tabs vs conversations vs execution vs hydration)
- Settings merge and fail-closed decoding of provider config
- Tests for behavior changes

## Manual UI checks

This is an Obsidian desktop plugin. There is no browser app to open with web tools. After UI changes:

- Load the plugin in a development vault (`npm run dev` into `.obsidian/plugins/dean`).
- Exercise the changed surface: send a message, switch tabs, toggle dual-pane, open settings, run inline edit.
- Confirm the other surfaces that read the same state still agree (history list, session manager, model selector, settings).
- Check empty, error, and streaming states, not only the happy path.
