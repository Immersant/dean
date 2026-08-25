# Source map

This is a directory-level map of the repository. Read the nearest `AGENTS.md` before editing a scoped area.

## Repository root

| Path | Role |
| --- | --- |
| `src/` | TypeScript sources |
| `tests/` | Jest unit and integration tests mirroring `src/` |
| `scripts/` | Build, test runners, and architecture checks |
| `docs/` | Human documentation (this folder) |
| `assets/` | README images and other static artwork |
| `manifest.json` | Obsidian plugin manifest |
| `versions.json` | Obsidian community-plugin map of plugin version → `minAppVersion`. `check-release-version.mjs` does not read it; it only compares the release tag with `package.json` and `manifest.json` |
| `styles.css` | Generated CSS output — do not edit |
| `main.js` | Generated plugin bundle — do not edit as source |
| `esbuild.config.mjs` | Bundler. Patches SDK `import.meta` and unsafe `unref` for Electron |
| `eslint.config.mjs` | Lint rules, including Obsidian plugin constraints |
| `jest.config.js` | Dual project: `tests/unit` and `tests/integration` |
| `AGENTS.md` | Agent execution rules |
| `.context/` | Non-committed notes, traces, and throwaway scripts |

Path aliases: `@/*` → `src/*`, `@test/*` → `tests/*`.

## `src/main.ts`

Plugin class. Registers the view, commands, ribbon, settings tab, file menu, and vault rename/delete handlers. Constructs app services. Implements `FeatureHost` and `ProviderHost` surfaces through those services.

## `src/app/`

Application-scoped state. Must not import chat views, feature controllers, or provider-native protocol.

| Path | Role |
| --- | --- |
| `conversations/ConversationRepository.ts` | Canonical in-memory conversation collection and persistence coordination |
| `providers/DeanProviderHost.ts` | Typed `ProviderHost` adapter |
| `settings/SettingsCoordinator.ts` | Serialized settings mutations with rollback |
| `settings/ChatModelSelectionCoordinator.ts` | Ordered future-tab model-seed commits |
| `settings/PinnedLinkedNotePathCoordinator.ts` | Pinned linked-note path mutations |
| `settings/DeanSettingsStorage.ts` | Vault JSON I/O for settings |
| `settings/defaultSettings.ts` | `DEFAULT_DEAN_SETTINGS` |
| `storage/SharedStorageService.ts` | Settings, sessions, conversation persistence, tab-layout plugin data |

## `src/core/`

Provider-neutral infrastructure.

| Path | Role |
| --- | --- |
| `execution/` | Backend, session, request, event, interaction, snapshot, lifecycle registry, rewind/steer mixins |
| `providers/` | Registries, capabilities, routing, model selection, environment, command catalogs, workspace contracts |
| `bootstrap/` | Persistence contracts and path constants (`.dean/`, sessions, input ledgers) |
| `auxiliary/` | Title generation, instruction refine, inline edit, text collectors |
| `prompt/` | Shared prompt text for main agent, inline edit, instruction refine, title generation |
| `session-sections/` | Editor session-section schema, codec, validation, prompt appendix, and context formatting |
| `artifacts/` | Editor artifact schema, HTML allowlist walk, codec, and authoring appendix |
| `commands/builtInCommands.ts` | `/clear`, `/add-dir`, `/resume`, `/fork`, `/fast` |
| `skills/` | Agent-skill document codec and repository |
| `storage/` | `VaultFileAdapter`, path-containment checks |
| `security/approvalRules.ts` | Approval helpers |
| `process/ManagedStdioProcess.ts` | Supervised stdio child processes |
| `rpc/JsonRpcTransport.ts` | JSON-RPC mechanics |
| `tools/` | Todo, tool names, icons, input, result content |
| `types/` | Chat, settings, tools, agents, plugins, diffs |
| `performance/StartupProfiler.ts` | Timed onload stages |

## `src/features/`

| Path | Role |
| --- | --- |
| `FeatureHost.ts` | Feature-facing application boundary |
| `chat/DeanView.ts` | Sidebar `ItemView` |
| `chat/controllers/` | Input, stream, turn, conversation, navigation, selections |
| `chat/tabs/` | Tab manager, lifecycle, session, forking, runtime builders |
| `chat/execution/` | Per-tab coordinator, session supervisor, warm pool |
| `chat/rendering/` | Message, tool, diff, thinking, subagent, plan, welcome |
| `chat/ui/` | Toolbar, composer tray, session sidebar, vault file tree |
| `chat/services/` | Bang-bash, mentions cache, subagent manager, tab persistence |
| `chat/session-manager/` | Dual-pane list organization and icons |
| `chat/state/` | Transient `ChatState` |
| `session-sections/` | `dean-session` Markdown processors, widgets, Collect write-back, and Act orchestration |
| `artifacts/` | `dean-artifact` Markdown processor and native `createEl` mount |
| `inline-edit/ui/` | CodeMirror overlay modal and markdown preview |
| `settings/` | Settings tab shell, skill coordinator, keyboard-nav parser |

## `src/providers/`

| Path | Role |
| --- | --- |
| `index.ts` | Registers the five built-in modules |
| `defaultProviderConfigs.ts` | Default `providerConfigs` bags |
| `acp/` | Shared ACP transport |
| `claude/` | Claude Agent SDK adapter (default) |
| `codex/` | Codex app-server JSON-RPC adapter |
| `grok/` | Grok Build ACP adapter |
| `opencode/` | OpenCode ACP adapter |
| `pi/` | Pi RPC adapter |

Typical provider layout (names vary):

```text
<provider>/
  registration.ts      # ProviderModule
  capabilities.ts      # Feature flags
  settings.ts          # Typed settings + defaults
  execution/           # Backend + session
  history/             # Read-only native replay
  runtime/             # Process, CLI, protocol
  app/                 # Workspace services
  commands/            # Command catalog
  env/                 # Settings reconciler
  ui/                  # Chat UI config + settings tab
  normalization/       # Native → core events/tools
```

## `src/shared/`

Reusable UI with no feature or provider ownership.

- `components/` — dropdowns, selection highlight
- `mention/` — `@` mention controller and vault cache
- `modals/` — confirm, fork target, instruction confirm
- `settings/` — env snippets, model picker, CLI path, MCP notes
- `icons.ts` — shared SVG helpers

## `src/style/`

Modular CSS. Register every new file in `index.css` or the CSS build fails.

| Folder | Owns |
| --- | --- |
| `base/` | Variables, container, animations, visibility |
| `components/` | Messages, input, tabs, history, tools, status |
| `toolbar/` | Composer provider-option controls |
| `features/` | Diff, inline edit, plan mode, slash commands, images |
| `modals/` | Fork and instruction |
| `settings/` | Settings shell modules |
| `accessibility.css` | Cross-feature a11y |

Classes use `.dean-` with BEM-lite names. Prefer Obsidian CSS variables.

## `src/i18n/`

`i18n.ts` plus `locales/{en,zh-CN,zh-TW,ja,ko,de,fr,es,ru,pt}.json`. English is the fallback and the TypeScript key source.

## `src/utils/`

Cross-cutting helpers: paths, env parsing, markdown, diffs, images, editor/browser/canvas context, CLI location, Electron compat, Windows cmd shims, concurrency, abort.

## `src/types/`

Ambient declarations (currently `smol-toml.d.ts`). Domain types live in `src/core/types/`.

## `tests/`

Tests mirror source names:

```text
tests/unit/<area>/<Name>.test.ts
tests/integration/...
tests/__mocks__/          # claude-agent-sdk, codex-sdk, obsidian
tests/fixtures/           # provider protocol children and transcripts
tests/helpers/            # DOM fakes and SDK fixtures
```

Qualifiers are allowed (`fileLink.dom.test.ts`). Test through the closest public owner. Mock environment and provider boundaries; prefer real Dean code for Dean-owned collaborators.

## `scripts/`

| Script | Role |
| --- | --- |
| `build.mjs` | CSS then esbuild |
| `build-css.mjs` | Concatenate `src/style/index.css` imports |
| `run-tests.js` | Jest plus architecture/identity node:test files |
| `run-jest.js` | Jest wrapper |
| `check-architecture-boundaries.test.mjs` | Import-graph enforcement |
| `check-product-identity.test.mjs` | Asserts package/manifest identity is Dean and scans the tree for the retired product name |
| `check-eslint-config.test.mjs` | Lint config sanity |
| `check-release-version.mjs` | Version alignment |
| `check-startup-performance.mjs` | Startup budget |
| `sync-version.js` | Keep `manifest.json` in sync on `npm version` |
| `postinstall.mjs` | Install-time setup |
| `rendererSafeUnref.js` | Strip unsafe `unref` from the Electron renderer bundle |
