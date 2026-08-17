# Concepts

This page describes Dean's domain model. The closest source of truth for each concept is listed so the document does not become a second implementation.

## Conversation

A `Conversation` (`src/core/types/chat.ts`) is Dean's durable record of one chat.

Important fields:

| Field | Meaning |
| --- | --- |
| `id` | Dean conversation identity |
| `providerId` | Owning adapter. Claude is the default (`DEFAULT_CHAT_PROVIDER_ID`) |
| `sessionId` | Provider-native resume identity, or `null` |
| `selectedModel` | Conversation-owned model selection |
| `providerState` | Opaque bag. Only the owning provider may interpret it |
| `modelRecoverySource` | Read-only native locator used only to recover a missing historical model |
| `messages` | Dean's in-memory projection after hydration |
| `currentNote` | Vault-relative path of the linked note |
| `isPinned` / `isArchived` | Session-manager flags. Archiving clears pin |
| `externalContextPaths` | Session-scoped extra directories |
| `resumeAtMessageId` | Assistant checkpoint after rewind |

`ConversationRepository` (`src/app/conversations/ConversationRepository.ts`) is the source of truth for the in-memory collection. Feature code must request mutations through `FeatureHost`. It also owns:

- Hydration status
- Pin / archive / note-link metadata
- Deletion transactions
- Per-conversation persistence queues
- Input-ledger coordination
- Historical model recovery
- Selected-model availability reconciliation
- Execution-snapshot binding

Closing a tab never deletes a conversation. Deletion is a separate application operation. Archiving cannot be inferred from tab closure. Dean never mutates or deletes provider-native history when a conversation changes.

`ConversationMeta` is the lightweight list projection used by history and the session manager. It does not require hydrated messages.

## Session metadata and input ledger

Dean persists UI-owned conversation metadata separately from provider transcripts. All of these files share `.dean/sessions/{conversationId}`:

- Session metadata: `{id}.meta.json`
- Accepted-input ledgers: `{id}.inputs.json` (canonical user input Dean sent)
- Deletion markers: `{id}.deleted.json`
- Legacy metadata still migrates from `.claude/sessions/{id}.meta.json`

Provider transcript files remain provider-owned and read-only. Live streaming comes from the provider runtime protocol. History hydration reads native transcripts through `ProviderConversationHistoryService`.

`Conversation.modelRecoverySource` must never be treated as a resumable provider binding. A successful recovery or a fresh provider session retires it.

## Settings

`DeanSettings` (`src/core/types/settings.ts`) is stored at `.dean/dean-settings.json`.

The bag mixes:

- User preferences (locale, keyboard navigation, view placement)
- Shared environment variables and snippets
- Projected provider fields (`model`, `thinkingBudget`, `effortLevel`, `serviceTier`, `permissionMode`)
- `providerConfigs`: opaque per-provider settings maps
- `lastSelectedChatModel`: explicit future-tab seed
- `pendingProviderSessionInvalidations`: durable provider-generation fences

`settingsProvider` is the provider whose model/effort/budget is currently projected onto the top-level fields. Writers must merge provider-owned configuration rather than replace it.

`SettingsCoordinator` serializes mutations, rolls back the in-memory snapshot if persistence fails, and publishes after a successful commit. A post-commit publication failure is reported as committed state; it must not roll back data that was already persisted.

Environment variables have two scopes: `shared` and `provider:<id>`. Snippets can target either. Environment keys that change a provider's runtime fingerprint invalidate or reload that provider's sessions according to its reconciler.

Only explicitly enabled models belong in the chat selector. There are no synthetic provider entries, no hidden session models, and no provider-default fallback when none are enabled.

The app-level default `model` seed is `haiku`. Claude's provider-owned `defaultModel` preference is `opus`. Those are different fields: the seed is what a blank tab starts from after availability checks; `defaultModel` is Claude's fallback when resolving its own options.

## Tabs versus conversations

A tab is a runtime view of at most one conversation. Conversations outlive tabs.

Three independent layers:

1. **Durable conversation state** — repository, metadata, input ledger, provider resume snapshot.
2. **Persisted tab shell** — New writes store a one-element `openTabs` array plus `activeTabId` (`DeanView.getPersistedCurrentTabState`). The type still allows a multi-tab `openTabs` list and optional `expandedTitleTabIds`; `normalizeTabManagerState` keeps those fields if they are present. Restore reopens only the `activeTabId` entry. Runtime tab membership, blank drafts, and expanded-title presentation are discarded on reload.
3. **Runtime tab state** — `TabSession`, `ChatState`, controllers, renderers, and DOM exist only for the current view.

Tab-layout snapshots live in Obsidian plugin data (`plugin.saveData`), not in `.dean/`. `SharedStorageService.setTabManagerState()` must preserve unrelated plugin data.

## Tab lifecycle

Valid values:

```text
provisional | cold | warm | closing
```

| State | Meaning |
| --- | --- |
| `provisional` | Dual-pane history preview. Selecting sessions alone must not retain every preview |
| `cold` | Retained tab without provider execution resources, including an unbound draft |
| `warm` | Tab that holds a provider execution session |
| `closing` | Terminal. New hydration is blocked; resources are disposed |

Hydration (`idle | loading | ready | failed`) is orthogonal. Do not infer execution state from hydration, visibility, or active selection.

Selecting a history session does not create a provider process. `ProviderTabWarmupPolicy` may request isolated command discovery. The reserved `execution` warmup mode is currently a no-op and must not create a chat session.

The warm pool may cool an idle tab back to `cold` without closing the tab or conversation. Active executions and unresolved interactions are protected.

## Layout modes

- **Single-panel**: tab bar plus tab-aware history. New Conversation and `/clear` replace the active tab's conversation. Fork prompts for a target tab.
- **Dual-pane**: tab bar hidden, persistent session manager visible, history navigation is provisional preview. Fork always creates a new retained runtime tab.

Layout changes navigation only. They must not rewrite conversation grouping, provider state, or durable session metadata.

The view can sit in the right sidebar, left sidebar, or a main workspace tab (`chatViewPlacement`). Dual-pane can also show a vault file tree (`enableFilePane`).

## Execution request

`InputController` builds a canonical `ExecutionInputSnapshot` (schema version 1) and a `ProviderExecutionRequest`. Providers own native prompt encoding.

A request carries:

- Input blocks (text and images)
- Context (current note, editor selection, browser selection, canvas selection, external directories)
- Optional conversation history for recovery
- Desired configuration (model, reasoning, permission mode, mode, service tier)
- Tool policy (`passive`, `read-only`, `provider-default`, `unrestricted`, or an allow-list)
- An `AbortSignal`

It does not carry credentials, environment, or a provider settings bag. The backend reads those from `ProviderHost` at execution time.

## Messages and stream chunks

`ChatMessage` stores role, content, optional display content (for slash-command expansion), tool calls, ordered `contentBlocks`, images, and the canonical `executionInput`.

`contentBlocks` preserve streaming order: text, tool use, thinking, subagent, citations, and context compaction.

Live turns emit `ProviderExecutionEvent`. Feature code converts those events to `StreamChunk` (`providerOutputEventToStreamChunk`) and still applies them through `StreamController.handleStreamChunk`. History hydration does not replay chunks: providers project native transcripts into `ChatMessage[]`, and `MessageRenderer.renderMessages` draws them. Automatic background turns also feed `handleStreamChunk`.

All providers must be able to produce the core chunk kinds: `text`, `tool_use`, `tool_result`, `error`, `done`, and `usage`.

## Models

Model identifiers are provider-qualified in Dean (for example Grok uses `grok/<raw-id>`). The owning `ProviderChatUIConfig` decides which models it owns, which are enabled, and what the selector shows.

Resolution distinguishes:

- Historical provider ownership of a stored selection
- Current enabled-option availability

`ConversationModelResolution.model` stays the readable stored value when a selection is unavailable. `modelToPersist` is the desired fallback. Readers must not project `modelToPersist` until `ConversationRepository` persists it.

An explicit chat model-picker action updates only the current blank tab or bound conversation, plus the provider-qualified global seed for future blank tabs. Existing tabs never subscribe to that seed. Restoration, hydration, automatic fallback, fork inheritance, and auxiliary executions must not update the seed.

## Permissions and modes

Shared permission modes are `yolo`, `plan`, and `normal`. Providers may map their native modes onto this contract (`Opencode` does this in `modes.ts`) or expose a provider-owned mode selector.

Plan mode is provider-specific. Claude uses Enter/Exit plan-mode tools. Grok layers a native ACP Plan mode over the remembered Safe or YOLO base. Providers that do not support plan mode must not be given a shared plan-mode toggle.

## External context and mentions

`@` mentions resolve vault files, subagents, and files in configured external directories. Persistent external directories live in settings. Session-scoped directories live on the conversation and reset on a new session. `/add-dir` adds a session-scoped directory.

Bang-bash (`!`) bypasses provider execution and runs a local shell command. It is available only when `ProviderChatUIConfig.isBangBashEnabled` is true. Claude ships with `enableBangBash: false`.

Instruction mode (`#`) refines custom instructions through an auxiliary agent query, then confirms them in a modal.

## Skills and slash commands

Slash commands come from several sources: `builtin`, `user`, `plugin`, and `sdk`. Runtime-discovered commands are read-only in Dean; providers own editing and deletion.

Built-in action commands (`src/core/commands/builtInCommands.ts`):

| Command | Action |
| --- | --- |
| `/clear` (`/new`) | Start a new conversation |
| `/add-dir` | Add an external context directory |
| `/resume` | Resume previous conversation (requires native history) |
| `/fork` | Fork the conversation (requires fork support) |
| `/fast` | Toggle Codex fast mode |

Slash-command triggers are provider-owned (`ProviderCommandDropdownConfig.triggerChars`). `/` is universal. `$` is Codex's skill prefix (`CodexSkillCatalog`); Claude and the other adapters list skills under `/`. Vault agent-skill documents (frontmatter + instructions) are parsed by `src/core/skills/` and edited from each provider settings tab.
