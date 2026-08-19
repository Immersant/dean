# Dean Canvas Agent Board Workflows Design

## Goal

Make Dean agents reliably use Obsidian Canvas as a visual workflow board while keeping durable user input, agent prompts, and generated outputs in Markdown notes with `dean-session` fences.

## Design principles

- Canvas is the board: it shows stages, artifacts, file nodes, and edges.
- Markdown is the source of truth: forms, answers, prompts, and outputs live in `.md` files.
- `dean-session` remains the interaction primitive for in-note forms and actions.
- Agents must not edit user answers unless the existing collect write-back path is doing so from UI controls.
- Canvas edits must be idempotent: stable node IDs and edge IDs update existing board elements instead of duplicating them.
- Provider behavior remains provider-neutral. Canvas workflows are prompt/context and feature code, not provider-specific code.

## MVP behavior

When a user has a canvas selection and asks Dean to continue a workflow, the agent should:

1. Read the selected `.canvas` file.
2. Resolve selected node IDs to canvas nodes.
3. If a selected node is a `type: file` node, read its linked Markdown file.
4. Detect any `dean-session` collect or act fence in that file.
5. Read the answers mapping without editing it.
6. Write results under the requested heading.
7. When the workflow advances, create follow-up Markdown form notes and add them back to the canvas as `type: file` nodes.
8. Connect nodes with labeled edges.
9. Validate canvas JSON after edits.

## Productized behavior

Dean should help agents do this consistently by adding:

- canvas board parsing/upsert utilities,
- richer canvas selection context in prompts,
- explicit system prompt guidance for board workflows,
- a canvas-embed action fallback for session-section buttons when confirm modals are unreliable,
- optional scaffold command/templates for creating an initial agent board,
- documentation and examples for core Obsidian features and community plugin integrations.

## Useful Obsidian surfaces

- Canvas: visual board, file nodes, workflow edges.
- Properties: note metadata for `workflow`, `stage`, `status`, `conversationId`, `canvas`, `next_action`.
- Bases or Dataview: dashboard of active workflow notes.
- Tasks: implementation checklists emitted from build/handoff stages.
- Templates or Templater: optional user-authored form templates.
- Advanced URI: optional deep links to forms, headings, and workspaces.

## Non-goals

- Do not store workflow state only in canvas JSON.
- Do not require community plugins for the core workflow.
- Do not add provider-specific canvas behavior.
- Do not make Excalidraw the primary form surface.
- Do not bypass session-section validation.
