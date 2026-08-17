# Providers

A provider is an adapter from a native coding-agent harness into Dean's execution, history, settings, and chat-UI contracts. Claude is enabled by default. Codex, Grok, OpenCode, and Pi are opt-in.

Do not assume feature parity. Capabilities are the gate.

## Capability matrix

| Capability | Claude | Codex | Grok | OpenCode | Pi |
| --- | --- | --- | --- | --- | --- |
| Native history | yes | yes | yes | yes | yes |
| Plan mode | yes | yes | yes | yes | no |
| Rewind | yes | no | yes | no | no |
| Fork | yes | yes | yes | no | yes |
| Provider commands | yes | yes | yes | yes | yes |
| Image attachments | yes | yes | yes | yes | yes |
| Instruction mode | yes | yes | yes | yes | yes |
| Turn steer | no | yes | yes | no | yes |
| Reasoning control | effort | effort | effort | effort | effort |
| Default enabled | yes | no | no | no | no |

Sources: each provider's `capabilities.ts` and `settings.ts`.

## Registration shape

Every built-in provider exports a `ProviderModule` from `registration.ts` and is registered in `src/providers/index.ts`.

A module supplies:

- `displayName`, `blankTabOrder`, `isEnabled` / `setEnabled`
- `capabilities` and optional `environmentKeyPatterns`
- `chatUIConfig` — synchronous selector/toggle projection
- `settingsReconciler` — environment and model invalidation
- `settingsStorage` — decode and migrate the provider's settings bag
- `createExecutionBackend`
- `historyService` and optional subagent history
- `taskResultInterpreter` and optional `subagentAdapter`
- `workspace` — CLI, commands, agents, settings tab

Blank-tab fallback order is the registry's explicit `blankTabOrder` (ascending), not display-name sort or registration insertion order. Current values: OpenCode 10, Pi 11, Grok 12, Codex 15, Claude 20. `getBlankTabProviderIds` reverses that list for the upward-opening selector. `resolveSettingsProviderId` still prefers enabled Claude before the first `blankTabOrder` entry.

Treat persisted provider configuration as untrusted runtime input. Readers must decode every field. Invalid permission, tool, and sandbox modes fail closed.

## Claude

`src/providers/claude/`

Default provider. Implements the contracts over `@anthropic-ai/claude-agent-sdk` and layers Claude Code CLI compatibility around it.

- Transport: persistent SDK query, kept alive across turns when possible.
- Restart the persistent query when `ClaudeExecutionRequestEncoder` rebuilds a different `restartKey`: system prompt, allowed/disallowed tools, hooks presence, extra directories, CLI path, setting sources, Chrome enablement, auto-mode (`safeMode === 'auto'`), or `persistSession`. Plugin enablement is not part of that key.
- Native transcripts: `{CLAUDE_CONFIG_DIR:-~/.claude}/projects/{vault}/`. Resolve the config dir; never hardcode `~/.claude`.
- Dean-managed Claude files: permissions and plugin enablement in `.claude/settings.json`. MCP is owned by Claude Code's native CLI. At storage init the composition root deletes leftover `.claude/mcp.json`.
- Plugin enabled state is dual-written to `.claude/settings.json` and `PluginManager.plugins[].enabled`.
- Slash command IDs use reversible encoding: dashes become `-_`, slashes become `--`.
- Token usage is merged: assistant messages for input-side counts, result messages for context-window data.
- `createCustomSpawnFunction()` handles Obsidian/Electron process quirks, including full-path `node` resolution.
- SDK amnesia (returned session ID differs from resume ID) injects full conversation history on the next turn unless this is the first `session_init` after a fork.
- `EnterPlanMode` does not hit `canUseTool`; `ExitPlanMode` does.
- Fresh settings prefer the Opus tier. An unavailable preference falls back without changing existing conversations or the future-tab seed.

## Codex

`src/providers/codex/`

OpenAI Codex via `codex app-server` over stdio JSON-RPC 2.0.

- Mandatory handshake: `initialize` with `{ experimentalApi: true }`, then notify `initialized`.
- Client requests: `thread/*`, `turn/*`, `skills/list`.
- Live output comes from JSON-RPC notifications. `thread/start` and `thread/resume` request `experimentalRawEvents: true`. Do not poll JSONL for live turns.
- JSONL under `~/.codex/sessions/` (and sibling `archived_sessions/`) is the replay source. Path resolution is WSL- and home-dir-aware.
- Existing threads require `thread/resume` before operations in a new app-server process.
- Forks resume the new fork thread before `thread/rollback`.
- Skill listing uses a separate short-lived app-server process.
- Runtime fingerprint includes `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `PATH`, CLI-path inputs, installation method, and WSL distro override.
- Images are written to a `dean-codex-images-` temp directory and cleaned up with the input bundle at turn end, steer completion, and session dispose. There is no `query()` method.
- Shared no-op task-result interpreter: Claude's async-agent task system does not apply.

## Grok

`src/providers/grok/`

Grok Build via Agent Client Protocol over `grok agent --no-leader stdio`.

- Shared ACP primitives live in `src/providers/acp/`. xAI extensions, launch policy, models, tools, and history stay Grok-owned. There is no generic ACP runtime superclass.
- Never call ACP `authenticate` automatically or persist xAI credentials.
- Preserve `Conversation.sessionId` and provider state across prompt, CLI-path, and environment changes. Recycle the process and load the same native session.
- Native history: `~/.grok/sessions/`, read-only.
- Images are ACP image content blocks. Steering and forks use `_x.ai/interject` and `_x.ai/session/fork`.
- Keep Grok/xAI tools enabled and preserve unknown tool data losslessly. Task-family lifecycle calls adapt into the shared subagent renderer while retaining raw names.
- Expose Safe, Plan, and YOLO. Plan is a native ACP session mode layered over the remembered Safe or YOLO base.
- Model ids are `grok/<raw-id>` in Dean and raw ids on the wire.
- Do not rewrite `~/.grok/config.toml`, own BYOK endpoints, or source shell startup files.
- Dean must never create, import, append, suppress, rewrite, or inject vault/runtime `AGENTS.md` files. Those belong to Grok's native discovery.

## OpenCode

`src/providers/opencode/`

OpenCode via ACP over `opencode acp`.

- Managed launch files live under `.dean/opencode/`. User OpenCode config and the native history database remain outside Dean ownership.
- `prepareOpencodeLaunchArtifacts()` writes managed config and system prompt, then layers them over `OPENCODE_CONFIG`.
- History hydration reads OpenCode's native SQLite database. `OpencodeSqliteReader` has fallbacks because runtime environments may not expose the same SQLite API.
- `providerState.databasePath` preserves the database used for a conversation until a typed history or environment transition replaces it.
- Runtime fingerprint includes `OPENCODE_CONFIG`, `OPENCODE_DB`, `OPENCODE_DISABLE_PROJECT_CONFIG`, `XDG_DATA_HOME`, `PATH`, and CLI-path inputs.
- Mode IDs map to shared permission modes in `modes.ts`.
- Command discovery warmup for blank tabs uses an isolated metadata database, not a persisted conversation session.
- File requests are permission-checked against the kernel's configured vault working directory.

## Pi

`src/providers/pi/`

Pi via `pi --mode rpc`.

- Launch arguments are built only in `PiLaunchSpec.ts`.
- Live events go through `normalizePiRpcEvent()` and `PiEventNormalizationState`.
- Extension UI requests route through `PiExtensionUiBridge` to `ObsidianPiExtensionUiRenderer`. Execution code must not manipulate Obsidian DOM.
- Compact turns call the `compact` RPC and emit `context_compacted`.
- History is JSONL from vault-local `.pi/agent/sessions/` and user-level `~/.pi/agent/sessions/`.
- Forking copies the source branch up to `resumeAt` into a new session file without altering the source.
- Pi can resume by session ID or absolute session file. Absolute session files can be switched in a live process; other target changes require process restart.
- `new_session` invalidates persisted session state until Pi reports a replacement.
- Runtime fingerprint includes `PI_CODING_AGENT_DIR`, `PI_CODING_AGENT_SESSION_DIR`, `PI_PACKAGE_DIR`, `PI_OFFLINE`, `PI_SKIP_VERSION_CHECK`, `PI_TELEMETRY`, `PI_CACHE_RETENTION`, `PATH`, and CLI-path inputs.

## Shared ACP layer

`src/providers/acp/` is transport and interaction only:

- Subprocess and JSON-RPC
- Session updates and tool-stream adapters
- Permission-request mapping
- Usage-info helpers

Provider-specific launch, extensions, normalization, history, and state stay in the owning provider directory.

## Adding or changing provider behavior

New-provider pull requests are not accepted. See [`CONTRIBUTING.md`](../CONTRIBUTING.md). Improvements to an existing provider are welcome when they preserve ownership boundaries.

When changing an existing provider:

1. Prefer provider-native behavior over local reimplementation.
2. Normalize at the boundary into core events, snapshots, or history projections.
3. Keep live streaming and history replay as separate authorities.
4. Put throwaway traces in `.context/`. Never commit credentials or personal paths.
5. Update `capabilities.ts` and `*ChatUIConfig` when user-visible behavior changes.
6. Test provider-neutral contracts first, then the adapter's distinct behavior.
