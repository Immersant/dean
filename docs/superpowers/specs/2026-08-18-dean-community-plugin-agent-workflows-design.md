# Dean Community Plugin Agent Workflows Design

## Goal

Extend the canvas-board workflow idea with optional community-plugin surfaces: Kanban for work tracking, Dataview for live dashboards, and Excalidraw for sketch/diagram artifacts.

## Current plugin facts checked on 2026-08-18

- Dataview treats a vault as a queryable database over Markdown pages and is primarily about displaying/querying indexed data, not editing it.
- The long-running Obsidian Kanban plugin is Markdown-backed; its repository currently notes it is looking for maintainers.
- There is also a newer community Kanban Board plugin that is Markdown-backed and supports drag-and-drop boards, nested lanes, search/filter, dates, note creation, and metadata display.
- Obsidian Excalidraw stores/edit drawings in the vault, can embed drawings in notes, and can link documents and drawings.

## Core idea

Dean should not depend on these plugins to work. Instead, Dean should generate plain Markdown, YAML properties, `.canvas` JSON, and linked artifact notes that become richer when a user has Kanban, Dataview, or Excalidraw installed.

## Possibilities

### 1. Kanban as workflow execution board

Dean can generate a Markdown-backed Kanban note with lanes such as:

- Intake
- Design
- Ready
- In progress
- Review
- Done
- Archived

Each card links to a Dean-session form note. The user can move cards manually in Kanban, while Dean keeps note properties synchronized when asked.

### 2. Dataview as live workflow dashboard

Dean can add properties to workflow notes:

```yaml
workflow: design-dashboard
stage: prototype
status: in-progress
agent_board: Random drawing with file viewer.canvas
conversationId: conv-...
next_action: Review prototype
```

A Dataview dashboard can list active forms, missing answers, next actions, and blocked work.

### 3. Excalidraw as visual artifact surface

Dean can create linked Excalidraw artifact notes for:

- wireframes,
- architecture sketches,
- journey maps,
- annotated UI states,
- implementation diagrams.

Dean should prefer creating/linking Excalidraw files and instructions over mutating complex drawing internals unless a stable integration exists.

### 4. Combined board

Canvas remains the master board:

```text
Canvas board
  ?? Kanban file node: work status board
  ?? Dataview dashboard note: live query view
  ?? Excalidraw file nodes: visual artifacts
  ?? Dean-session form notes: interaction + outputs
```

## Safety model

- Community plugins are optional enhancements.
- Dean writes plain files users can inspect.
- Dean never assumes a plugin is installed unless detected or the user confirms.
- Dean does not rely on undocumented plugin internals for MVP behavior.
- Dean does not edit `answers` mappings except through the existing collect write-back flow.
