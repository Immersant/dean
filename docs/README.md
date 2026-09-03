# Dean documentation

Dean is an Obsidian plugin that embeds provider-backed coding agents in a sidebar chat and an inline-edit flow. The vault is the agent's working directory. Claude is the default provider. Codex, Grok, OpenCode, and Pi are optional adapters that plug into the same conversation model.

This folder is the human-readable project documentation. Agent execution rules live in the root [`AGENTS.md`](../AGENTS.md) and the scoped `AGENTS.md` files under `src/`. User installation and troubleshooting stay in the root [`README.md`](../README.md).

| Document | Contents |
| --- | --- |
| [Architecture](architecture.md) | Layers, composition root, dependency direction, and host contracts |
| [Concepts](concepts.md) | Conversations, tabs, execution, settings, and persistence |
| [Features](features.md) | Chat, inline edit, settings, commands, mentions, and plan mode |
| [Providers](providers.md) | Built-in adapters, capabilities, and native protocols |
| [Source map](source-map.md) | Directory-by-directory guide to `src/`, `tests/`, and `scripts/` |
| [Development](development.md) | Tooling, verification, conventions, and how to change the code |

Current plugin identity:

- Package and plugin id: `dean`
- Version: `2.1.4` (`package.json` and `manifest.json`)
- Obsidian: desktop only, `minAppVersion` `1.7.2`
- Runtime: Node `>=24 <25` (CI uses `.node-version`)

Dated implementation specs and plans are not kept in `docs/`. Git history is the archive for retired design records.
