# Architecture

Dean is a layered Obsidian plugin. The composition root wires concrete services; features talk to application capabilities through `FeatureHost`; providers talk to application capabilities through `ProviderHost`; and `src/core/` owns the provider-neutral contracts both sides implement.

Do not assume provider parity. Shared behavior is expressed through registries and capabilities. Check each provider's `capabilities.ts`, `registration.ts`, and `*ChatUIConfig` before wiring a feature as if every adapter supports it.

## Layers

| Area | Responsibility |
| --- | --- |
| `src/main.ts` | Plugin lifecycle and concrete application composition |
| `src/app/` | Conversation repository, settings transactions, provider-host adapter, and shared storage |
| `src/core/` | Provider-neutral runtime, registries, storage contracts, tools, prompts, and types |
| `src/providers/acp/` | Shared Agent Client Protocol transport and session primitives, without provider policy |
| `src/providers/*/` | Provider adaptors: native protocol, history, storage, settings, and UI |
| `src/features/chat/` | Sidebar chat orchestration against provider-neutral contracts |
| `src/features/inline-edit/` | Inline edit CodeMirror overlay. The execution service lives in `src/core/auxiliary/` |
| `src/features/settings/` | Shared settings shell and provider tab assembly |
| `src/shared/` | Reusable UI components, mention dropdowns, and settings widgets |
| `src/style/` | Modular CSS built into root `styles.css` |
| `src/i18n/` | Translation dictionaries (10 locales) |
| `src/utils/` | Cross-cutting helpers with no layer authority |

## Dependency direction

`A -> B` means `A` may import or call `B`:

```text
composition root (src/main.ts)
  -> app services + features + provider registrations + core

app services -> core contracts
  (exception: default provider-config assembly in src/app/settings/defaultSettings.ts)

features -> FeatureHost + core contracts + shared UI

providers -> ProviderHost + core contracts + shared provider and UI primitives
```

Hard rules:

- `core/` must not import feature code, app composition, or provider implementations.
- Feature code must not import provider implementations. Resolve behavior through `ProviderRegistry`, `ProviderWorkspaceRegistry`, capabilities, and `ProviderChatUIConfig`.
- Provider runtime and protocol code must not import chat views, feature controllers, or other feature orchestration.
- Existing Claude compatibility re-exports that point into `src/app/` are migration seams, not a general dependency direction. The remaining seams are `src/providers/claude/storage/DeanSettingsStorage.ts`, `src/providers/claude/storage/StorageService.ts`, and `src/providers/claude/types/settings.ts`. Do not add new provider-to-app imports; move shared contracts into `core/` when those seams change.
- `src/app/settings/defaultSettings.ts` may import `src/providers/defaultProviderConfigs.ts` for default assembly. That is the only allowed app-to-provider implementation import.
- `src/providers/acp/` may hold protocol primitives shared by ACP providers. Launch policy, extensions, normalization, history, and state stay in the owning provider.
- If a dependency does not fit these directions, introduce or extend an explicit contract at the owning boundary.

`scripts/check-architecture-boundaries.test.mjs` enforces the import graph. `npm test` runs it after Jest.

## Composition root

`DeanPlugin` in `src/main.ts` is the only class that may construct the whole application.

Module evaluation (before `onload`):

1. Patches Electron/Node incompatibilities (`patchSetMaxListenersForElectron`) before any SDK import.
2. Side-effect imports `src/providers/index.ts`, which registers the five built-in providers.

`onload` then:

1. Calls `loadSettings({ deferNonRestoredSessionMetadata: true })`. That constructs `SharedStorageService`, deletes leftover `.claude/mcp.json`, then loads `.dean/dean-settings.json`.
2. Registers the `dean-view` item view, the file-menu "Add to Dean" item, vault rename/delete handlers, ribbon icon, commands, and the settings tab.
3. Schedules remaining session-metadata hydration so the first paint is not blocked.

On unload it asks every `DeanView` to prepare for plugin unload, disposes the execution lifecycle registry, and disposes initialized provider workspaces.

`DeanPlugin` is not the public API for features or providers. Features receive a `FeatureHost` surface that the plugin satisfies structurally (it does not declare `implements FeatureHost`). Providers receive `DeanProviderHost`, which implements `ProviderHost` and delegates back to the plugin.

## Host contracts

### FeatureHost

`src/features/FeatureHost.ts` is the feature-facing application boundary. `DeanView`, settings, and inline edit type their host as `FeatureHost`, not `DeanPlugin`. It exposes:

- Obsidian `app`, settings, storage, provider host, warm-execution pool
- Settings mutations
- Conversation create / switch / delete / pin / archive / rename / update
- Conversation list and cache reads
- View lookup and cross-view conversation search
- Chat model-selection intents for future blank tabs

Features must not import `DeanPlugin` from `src/main.ts`.

### ProviderHost

`src/core/providers/ProviderHost.ts` is the provider-facing application boundary. It exposes:

- Settings, storage, environment scopes, CLI resolution
- Execution lifecycle transitions
- Settings mutation and runtime-fingerprint persistence
- Chat-option change publication

It deliberately excludes plugin lifecycle, command registration, and conversation ownership. Providers must not reach through it to chat views or feature controllers.

`src/app/providers/DeanProviderHost.ts` is the typed adapter that implements `ProviderHost`. It owns no duplicate settings, storage, view, or execution state.

## Registries

Provider behavior is registered, not discovered by `switch (providerId)` in feature code.

| Registry | Owns |
| --- | --- |
| `ProviderRegistry` | Chat-facing registration: capabilities, UI config, execution backend factory, history service, settings reconciler, auxiliary services |
| `ProviderWorkspaceRegistry` | Workspace services: CLI resolution, command catalogs, agent mentions, settings tab renderers, model-catalog refresh |

A built-in provider is a `ProviderModule`: a `ProviderRegistration` plus `id`, `settingsStorage`, and `workspace`. Registration happens once in `src/providers/index.ts`.

`ProviderSettingsCoordinator` normalizes provider selection, persists projected provider state onto top-level settings fields, and reconciles environment or model-option changes. Application settings writers must go through `SettingsCoordinator` so rollback and publication stay ordered.

## Execution pipeline

Feature code never talks to a provider CLI. The pipeline is:

```text
InputController
  -> canonical ExecutionInputSnapshot / ProviderExecutionRequest
  -> ChatExecutionCoordinator
  -> ProviderExecutionBackend.createSession(config)
  -> ProviderExecutionSession.execute(request)
  -> AsyncIterable<ProviderExecutionEvent>
  -> StreamController / renderers
```

`ProviderExecutionBackend` is cheap. It does not own a live process. `ProviderExecutionSession` owns one native session/process lifecycle and accepts at most one requested execution at a time.

Events are enveloped with a scope (`requested`, `background`, or `session`) and a monotonic sequence. Feature code must treat `providerPayload` as opaque.

Interactions (approvals, ask-user questions, plan-mode exit) go through `ProviderInteractionPort`, not through ad-hoc DOM from the provider.

`ProviderExecutionLifecycleRegistry` is the source of truth for provider generations, transition fencing, and live session leases. It does not own per-tab turn state and does not impose the warm-process capacity limit.

`WarmExecutionPool` is a separate feature-owned LRU of warm execution owners. The configured `maxWarmAgentProcesses` limit is clamped to 5–10. Runtime tab count is unlimited.

## Auxiliary executions

Title generation, instruction refinement, and inline edit reuse the same execution backends through `src/core/auxiliary/`. They own independent processes and sessions. They must not share a live chat session.

Title generation routes by the global `titleGenerationModel`, independently of the active chat provider.

## Style and i18n

CSS is modular under `src/style/` and concatenated into root `styles.css` by `scripts/build-css.mjs`. Dean-owned classes use the `.dean-` prefix. Never edit generated `styles.css` by hand.

UI strings go through `src/i18n/i18n.ts`. English is bundled eagerly; other locales load lazily. Available locales: `en`, `zh-CN`, `zh-TW`, `ja`, `ko`, `de`, `fr`, `es`, `ru`, `pt`.
