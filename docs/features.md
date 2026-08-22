# Features

User-facing features live under `src/features/`. They orchestrate presentation and conversation operations. They do not own provider-native processes or storage formats.

## Chat sidebar

`DeanView` (`src/features/chat/DeanView.ts`) is the Obsidian `ItemView` with type `dean-view`. It assembles the tab bar, chat panel, session manager, optional vault file tree, and input footer.

Open it from the ribbon bot icon or the **Open chat view** command. Placement follows `settings.chatViewPlacement`.

### Tab stack

| Module | Authority |
| --- | --- |
| `TabManager` | Runtime-tab membership, active-tab selection, create / switch / close |
| `TabRuntimeFactory` | Atomic per-tab assembly, publication, and rollback |
| `TabLifecycle` | Activation, provisional retention, shutdown drainage, teardown |
| `TabProviderState` | Provider / model / settings resolution and UI gating |
| `TabSessionEvents` | Provider-session event routing and automatic-turn rendering |
| `TabForking` | Fork-source resolution and immutable fork-context preparation |
| `TabSession` | Per-tab identity, conversation binding, lifecycle value, execution coordinator |
| `TabModelSelectionCoordinator` | Per-tab model-selection ordering and blank-tab provider-transition serialization |
| `ChatExecutionCoordinator` | One tab's provider-session binding, active execution, interaction fencing |
| `ExecutionSessionSupervisor` | Per-tab lease of the live `ProviderExecutionSession` |
| `ChatState` | Transient per-tab message projection, stream state, queued input |
| `TabStatePersistenceCoordinator` | Debounced writes of the current-tab snapshot |
| `TabBar` | Expanded-title presentation |

Builders under `tabs/runtime/` are internal to `TabRuntimeFactory`. They return complete shell, service, UI, controller, and input-binding bundles. Every acquired resource registers rollback immediately.

Tab IDs are reserved before asynchronous assembly. Admission and activation are one transaction: failure removes the assembled runtime and restores the previous active owner. Switching the active tab must not cancel another tab's execution.

### Controllers

| Controller | Role |
| --- | --- |
| `InputController` | Canonical execution requests, slash commands, mentions, images |
| `StreamController` | Applies provider events to `ChatState` |
| `TurnCoordinator` | One-turn send / cancel / completion |
| `StreamingRenderCoordinator` | Batches DOM updates during streaming |
| `ConversationController` | History list, pin, archive, delete, title |
| `NavigationController` | Keyboard and history navigation |
| `SelectionController` | Editor selection context |
| `BrowserSelectionController` | Browser selection context |
| `CanvasSelectionController` | Canvas selection context and safe node summaries |

Renderers and UI components may render state and emit user intent. They must not mutate tab membership, conversation persistence, or provider-session lifecycle.

Canvas selection context contains the Canvas path and selected node summaries copied from Obsidian's live Canvas objects. Summaries may include node type, file and subpath, text, label, URL, and color; text is capped at 200 characters. Polling does not read linked vault files or parse `dean-session` fences. The agent can read a selected file node's path later when the task requires its contents.

### Renderers

| Renderer | Surface |
| --- | --- |
| `MessageRenderer` | User and assistant messages |
| `ToolCallRenderer` | Tool cards |
| `WriteEditRenderer` | File write / edit previews |
| `DiffRenderer` | Word- and line-level diffs |
| `ThinkingBlockRenderer` | Reasoning blocks |
| `SubagentRenderer` | Nested agent runs |
| `CitationRenderer` | Memory citations |
| `TodoListRenderer` | Todo tool output |
| `InlineAskUserQuestion` | Ask-user prompts |
| `InlinePlanApproval` / `InlineExitPlanMode` | Plan-mode gates |
| `WelcomeRenderer` | Empty-state welcome |
| `DisplayOnlyCodeFences` | Fences that must not be treated as live tools |

### Composer and chrome

- `InputToolbar` — model, reasoning, permission, mode, and service-tier controls driven by `ProviderChatUIConfig`
- `ComposerContextTray` — current note, files, images, external directories
- `InstructionModeManager` — `#` instruction refinement
- `BangBashModeManager` — `!` local shell
- `StatusPanel` — usage and process status
- `NavigationSidebar` / session manager — dual-pane history
- `VaultFileTree` — optional file pane with create / rename / delete

The file-explorer context menu **Add to Dean** (`fileMenu.ts`) inserts an `@mention` of the file into the active composer.

### Rewind and fork

Rewind is an optional session capability (`RewindableExecutionSession`). Claude and Grok support it. Codex, OpenCode, and Pi do not advertise rewind.

Forking is provider-owned. Feature code uses execution and history contracts (`buildForkProviderState`) instead of reconstructing native session IDs. The user picks a target through `ForkTargetModal`.

Turn steering (`SteerableExecutionSession`) is advertised by Codex, Grok, and Pi.

## Inline edit

The **Inline edit** command runs against the active Markdown view.

- If the editor has a non-empty selection, Dean replaces that selection.
- Otherwise it inserts at the cursor, using surrounding line context.

`InlineEditModal` is a CodeMirror overlay: an input widget, then a word-level diff or insertion preview. Accept / reject apply or discard the change.

The edit itself is an auxiliary provider execution (`InlineEditService` in `src/core/auxiliary/`). It uses the same backends as chat but a separate session, a dedicated prompt (`src/core/prompt/inlineEdit.ts`), a **read-only** tool policy, and `PASSIVE_AUXILIARY_INTERACTION_PORT` (no approval or ask-user UI). The composer can mention vault files and attach the same external-context directories as the active tab.

## Editor session sections

Editor session sections are opt-in through **Enable editor session sections** in settings. They are fenced `dean-session` YAML blocks that agents can leave in vault notes for durable actions or forms.

Bound Act sections submit a prepared prompt after user confirmation. Bound Collect sections save answers back into the note and can focus their existing conversation with **Open chat**.

Standalone Collect sections set `startNewChat` to a required submit-button label, omit `conversationId`, `epoch`, and actions, then open an unsent editable draft in a fresh Dean chat using the current default provider and model. The source note path appears in the draft text only; Dean does not automatically attach the note as execution context.

Several fences in the same note may share an optional `formId` so a form can be split around normal editor prose. Bound members must share `conversationId` and `epoch`; Act submit sends every member's merged questions and current answers with the prepared prompt. Standalone members all set `startNewChat` to a button label; that control composes the full form. Dean shows Act / the authored standalone submit only on the last `formId` member. Bound and standalone fences cannot share a `formId`. **Open chat** still only focuses the bound conversation.

```dean-session
schemaVersion: 1
id: discovery
kind: collect
title: Discovery questions
status: open
createdAt: 1786992000000
startNewChat: Start new chat
questions:
  - id: goal
    prompt: What should we build?
    type: markdown
answers: {}
```

## Settings

`DeanSettingTab` (`src/features/settings/DeanSettings.ts`) is the Obsidian settings tab. Tabs are `general` plus one tab per registered provider id.

**General** is a single pane with headings: language, Display (placement, dual-pane, file pane, auto-scroll, math deferral, expand-edits), Conversations (auto-title, title locale/model), Content (user name, system prompt, excluded tags, media folder), Input (send-key, vim-style nav mappings), Hotkeys (links into Obsidian's hotkey pane as `dean:<command-id>`), Environment (shared variables and snippets), and Advanced (warm-process limit).

**Provider tabs** each render through that provider's `ProviderSettingsTabRenderer`. Vault agent-skill editing is injected into those tabs via `renderAgentSkillSettings` / `AgentSkillManagementCoordinator`, not a separate Skills pane. Per-provider environment, CLI path, and model pickers live here too.

Shared widgets live in `src/shared/settings/` (model picker, hostname CLI path, env snippets, MCP notes, enablement warnings). Provider-specific controls stay in `src/providers/<id>/ui/`.

## Commands registered with Obsidian

| Command id | Name | Notes |
| --- | --- | --- |
| `open-view` | Open chat view | Activates or creates the Dean leaf |
| `inline-edit` | Inline edit | Editor command |
| `new-tab` | New | Always available when a tab manager exists. In wide/dual-pane layout it reuses an unbound draft (`activateOrCreateDraftTab`) instead of always opening another tab |
| `new-session` | Replace current conversation | Hidden in dual-pane. Blocked while streaming |
| `close-current-tab` | Close current tab | Hidden in dual-pane |
| `copy-startup-diagnostics` | Copy startup diagnostics | `StartupProfiler` clipboard dump |

Hotkeys are Obsidian's. The settings tab looks up `dean:<command-id>` and opens Obsidian's hotkey pane filtered to "Dean".

## Slash commands, skills, and mentions

Typing `/` opens `SlashCommandDropdown`. Built-in action commands run locally. Provider and user commands expand into prompts or are forwarded natively.

`$` is not a global trigger. Codex's command catalog adds `$` as a skill prefix (`triggerChars: ['/', '$']`). Claude, Grok, OpenCode, and Pi use `/` only. Typing `@` opens `MentionDropdownController` over vault files, agents, and external-context paths. `!` enters bang-bash only when the active provider enables it.

Provider command caches are resource-generation fenced. Cache identities contain only provider-owned non-secret fingerprints and monotonic generations.

## Plan mode

Toggle via `Shift+Tab` when the active provider supports it. The agent explores and designs, then presents a plan for approval. Enter-plan and exit-plan interactions are provider-normalized into `ProviderPlanInteractionRequest` and the inline plan renderers.

## Images

Images can be pasted, dropped, or attached as files. `ImageAttachment` stores base64 as the single source of truth. Providers encode images onto their native wire (SDK image blocks, ACP image content, temp files for Codex, prompt image blocks for Pi).
