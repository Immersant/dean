# Dean

<p>
  <img src="https://img.shields.io/github/stars/Immersant/dean" alt="GitHub stars" vspace="10">
  <img src="https://img.shields.io/github/v/release/Immersant/dean" alt="GitHub release" vspace="10">
  <img src="https://img.shields.io/github/license/Immersant/dean" alt="License" vspace="10">
</p>

![Preview](assets/Preview.png)

An Obsidian plugin that embeds AI coding agents (Claude Code, Codex, Grok, Opencode, Pi, and more to come) in your vault. Your vault becomes the agent's working directory — file read/write, search, bash, and multi-step workflows all work out of the box.

## Features & Usage

Open the chat sidebar from the ribbon icon or command palette. Select text and use the hotkey for inline edit. Everything works like your familiar coding agent, Claude Code, Codex, Grok, Opencode, and Pi — talk to the agent, and it reads, writes, edits, and searches files in your vault.

**Inline Edit** — Select text or start at the cursor position + hotkey to edit directly in notes with word-level diff preview.

**Slash Commands & Skills** — Type `/` for reusable prompt templates and Skills from user- and vault-level scopes. Codex also accepts `$` as a skill prefix.

**`@mention`** - Type `@` to mention anything you want the agent to work with, including vault files, subagents, and files in external directories.

**Plan Mode** — Toggle via `Shift+Tab`. The agent explores and designs before implementing, then presents a plan for approval.

**Instruction Mode (`#`)** — Refined custom instructions added from the chat input.

**MCP Servers** — Connect external tools through each coding agent's native CLI-managed MCP configuration.

**Tabs & Session Management** — Use multiple tabs in single-panel mode or a persistent session manager beside the chat in dual-pane mode.

## Requirements

- At least one of the following harnesses:
  - [Claude Code CLI](https://code.claude.com/docs/en/overview)
  - [Codex CLI](https://github.com/openai/codex)
  - [Grok Build](https://github.com/xai-org/grok-build)
  - [OpenCode](https://github.com/anomalyco/opencode)
  - [Pi](https://github.com/earendil-works/pi)
- A compatible subscription or API provider, such as [OpenRouter](https://openrouter.ai/docs/guides/guides/claude-code-integration), [Kimi](https://platform.kimi.ai/docs/guide/claude-code-kimi), [GLM](https://docs.z.ai/devpack/tool/claude), or [DeepSeek](https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code).
- Obsidian v1.7.2+
- Desktop only (macOS, Linux, Windows)

## Installation

### From source (development)

1. Clone this repository into your vault's plugins folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/Immersant/dean.git
   cd dean
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Enable the plugin in Obsidian:
   - Settings → Community plugins → Enable "Dean"

### Development

```bash
# Watch mode
npm run dev

# Production build
npm run build
```

## Privacy & Data Use

- **Sent to API**: Your input, attached files, images, and tool call outputs. Depending on the selected provider, data is sent to Anthropic (Claude), OpenAI (Codex), xAI (Grok), or the providers configured in OpenCode or Pi. The destination can be configured through provider settings and environment variables.
- **No telemetry or unsolicited background activity**: Dean does not run telemetry beacons. UI polling timers read local Obsidian/editor selection state only. Network activity is limited to explicit provider runtime work, configured MCP endpoints, and provider SDK/CLI calls needed to answer your requests.

## Troubleshooting

The following sections use Claude Code as an example.

### Provider CLI not found

If Dean cannot auto-detect a provider CLI, verify that the CLI is installed and available to GUI applications through PATH. Typical errors include `spawn claude ENOENT` and `Claude CLI not found`. This issue is common with Node version managers (nvm, fnm, volta).

Leave the CLI path setting empty first so Dean can auto-detect the CLI. If auto-detection fails, find the executable path and set it in Settings → Advanced → Claude CLI path.

| Platform | Command | Example Path |
|----------|---------|--------------|
| macOS/Linux | `which claude` | `/Users/you/.volta/bin/claude` |
| Windows (native) | `where.exe claude` | `C:\Users\you\AppData\Local\Claude\claude.exe` |
| Windows (npm) | `npm root -g` | `{root}\@anthropic-ai\claude-code\cli-wrapper.cjs` |

> **Note**: On Windows, avoid `.cmd` and `.ps1` wrappers. Use `claude.exe` for native installs, or `cli-wrapper.cjs` for package-manager installs. `cli.js` is only a legacy fallback for older Claude Code npm packages.

**Alternative**: Add your Node.js bin directory to PATH in Settings → Environment → Custom variables.

### npm CLI and Node.js not in the same directory

When using an npm-installed provider CLI, make sure its executable and Node.js are available from the same environment. Check their paths:

```bash
dirname $(which claude)
dirname $(which node)
```

If the paths differ, GUI apps like Obsidian may not find Node.js.

Either:

1. Install the native binary (recommended).
2. Add the Node.js path in Settings → Environment: `PATH=/path/to/node/bin`.

### More help

For provider-specific installation and configuration guidance, refer to the provider documentation linked in the [Requirements](#requirements) section. If you have a feature request or run into a bug, please [submit a GitHub issue](https://github.com/Immersant/dean/issues).

## Architecture

Dean is a layered Obsidian plugin. `src/main.ts` composes the application. Features talk to `FeatureHost`. Providers talk to `ProviderHost`. `src/core/` owns the provider-neutral contracts both sides implement.

```
src/
├── main.ts                      # Plugin lifecycle and composition root
├── app/                         # Conversation repository, settings, storage, provider host
├── core/                        # Provider-neutral runtime, registries, and type contracts
│   ├── execution/               # Sessions, events, interactions, lifecycle leases
│   ├── providers/               # Provider registry and workspace services
│   ├── auxiliary/               # Title generation, instruction refine, inline edit
│   ├── bootstrap/               # Persistence contracts and storage paths
│   └── ...                      # commands, prompt, skills, storage, tools, types
├── providers/
│   ├── claude/                  # Claude Agent SDK adaptor (default)
│   ├── codex/                   # Codex app-server JSON-RPC adaptor
│   ├── grok/                    # Grok Build ACP adaptor
│   ├── opencode/                # OpenCode ACP adaptor
│   ├── pi/                      # Pi RPC adaptor
│   └── acp/                     # Shared Agent Client Protocol transport
├── features/
│   ├── chat/                    # Sidebar chat: tabs, controllers, renderers
│   ├── inline-edit/             # Inline edit modal
│   └── settings/                # Settings shell with provider tabs
├── shared/                      # Reusable UI components and modals
├── i18n/                        # Internationalization (10 locales)
├── types/                       # Ambient type declarations
├── utils/                       # Cross-cutting utilities
└── style/                       # Modular CSS built into styles.css
```

Project documentation lives in [`docs/`](docs/README.md): [architecture](docs/architecture.md), [concepts](docs/concepts.md), [features](docs/features.md), [providers](docs/providers.md), [source map](docs/source-map.md), and [development](docs/development.md). Agent execution rules stay in [`AGENTS.md`](AGENTS.md).

## Contributing

Issues and focused pull requests are welcome. Issues are the preferred starting point: describe the problem, reproduction steps, and environment clearly so it can be investigated.

Before opening a pull request, please read the [contribution guide](CONTRIBUTING.md). Pull requests must explain the problem, the proposed solution, why the approach is appropriate, and how the change was validated. Pull requests that add a new provider are not accepted; the guide explains this maintenance and product-quality boundary in detail.

## Star History

<a href="https://www.star-history.com/?repos=Immersant%2Fdean&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Immersant/dean&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Immersant/dean&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Immersant/dean&type=date&legend=top-left" />
 </picture>
</a>

## Sponsorship

### Kimi (Moonshot AI)

<img src="https://gcdn.moonshot.cn/growth-cdn/sponsor/kimi-en.png" alt="Kimi (Moonshot AI)" width="90%">

Thanks to Kimi (Moonshot AI), our Open Source Friend, for supporting Dean! With 2.8T parameters, native vision, and a
1-million-token context window, Kimi K3 delivers frontier performance across long-horizon coding, knowledge work, and
reasoning.

New users receive bonus API credits equal to 10% of their first successful top-up. Use the discount link for the
[CN](https://platform.kimi.com) or
[Global](https://platform.kimi.ai) platform. This offer
ends September 30, 2026. Dean receives no affiliate commission from these links.

### Ke Holdings Inc. (BEIKE)

<img src="assets/sponsors/MOMA.png" alt="MOMA" width="90%">

Dean is proudly sponsored by Ke Holdings Inc. (BEIKE) and the MOMA team. Their support helps Dean continue to
improve through ongoing development and maintenance.

> Want to support Dean or appear here? Contact me: [tysk01213@gmail.com](mailto:tysk01213@gmail.com).

## License

Licensed under the [MIT License](LICENSE).
