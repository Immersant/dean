# Dean Community Plugin Agent Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Kanban, Dataview, and Excalidraw workflow artifacts around Dean's canvas-board + Markdown `dean-session` workflow pattern.

**Architecture:** Keep Dean's core workflow Markdown-native. Add optional artifact generators that produce Kanban-compatible Markdown, Dataview dashboard notes, and Excalidraw placeholder/link notes without requiring those plugins. Surface everything through Canvas file nodes and stable note properties.

**Tech Stack:** TypeScript, Obsidian plugin APIs, Jest, Markdown, YAML properties, Obsidian `.canvas` JSON, optional Dataview/Kanban/Excalidraw community plugins.

**Spec:** docs/superpowers/specs/2026-08-18-dean-community-plugin-agent-workflows-design.md

## Global Constraints

- Community plugin support must be optional; Dean must still work with only Markdown and Canvas.
- Do not import community plugin code or depend on undocumented plugin internals for MVP behavior.
- Use plain Markdown and YAML properties as the interchange format.
- Canvas updates must use stable node IDs and edge IDs.
- Session-section form answers must not be edited except through the existing collect write-back path.
- Follow repository dependency direction in `AGENTS.md`.
- Do not use `console.*` in production code.

---

## File Structure

- Create `src/features/community-workflows/CommunityWorkflowArtifacts.ts` for pure Markdown artifact builders.
- Create `src/features/community-workflows/CommunityWorkflowScaffold.ts` for composing Kanban, Dataview, Excalidraw, and Canvas files.
- Create `src/features/community-workflows/index.ts` as the feature barrel.
- Modify `src/main.ts` to add a command named `Create Dean community workflow board`.
- Modify `src/core/canvas-board/canvasBoardPrompt.ts` from the prior canvas-board plan to mention optional community surfaces.
- Test with `tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts` and `tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`.
- Document in `docs/community-plugin-agent-workflows.md`.

---

### Task 1: Add Markdown artifact builders for Kanban, Dataview, and Excalidraw links

**Files:**
- Create: `src/features/community-workflows/CommunityWorkflowArtifacts.ts`
- Create: `src/features/community-workflows/index.ts`
- Test: `tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts`

**Interfaces:**
- Produces: `buildKanbanWorkflowBoard(options: KanbanWorkflowBoardOptions): string`
- Produces: `buildDataviewWorkflowDashboard(options: DataviewWorkflowDashboardOptions): string`
- Produces: `buildExcalidrawArtifactIndex(options: ExcalidrawArtifactIndexOptions): string`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  buildDataviewWorkflowDashboard,
  buildExcalidrawArtifactIndex,
  buildKanbanWorkflowBoard,
} from '@/features/community-workflows';

describe('CommunityWorkflowArtifacts', () => {
  it('builds a Markdown-backed Kanban board linking Dean forms', () => {
    const board = buildKanbanWorkflowBoard({
      title: 'Dean Workflow Kanban',
      cards: [
        { lane: 'Intake', title: 'Palette form', notePath: 'Canvas design palette form.md' },
        { lane: 'Review', title: 'Prototype review', notePath: 'Canvas prototype review form.md' },
      ],
    });

    expect(board).toContain('kanban-plugin: board');
    expect(board).toContain('## Intake');
    expect(board).toContain('- [ ] [[Canvas design palette form.md|Palette form]]');
    expect(board).toContain('## Review');
  });

  it('builds a Dataview dashboard over workflow properties', () => {
    const dashboard = buildDataviewWorkflowDashboard({ workflow: 'design-dashboard' });

    expect(dashboard).toContain('```dataview');
    expect(dashboard).toContain('FROM ""');
    expect(dashboard).toContain('workflow = "design-dashboard"');
    expect(dashboard).toContain('TABLE status, stage, next_action');
  });

  it('builds an Excalidraw artifact index with linked drawing placeholders', () => {
    const index = buildExcalidrawArtifactIndex({
      title: 'Visual artifacts',
      drawings: [
        { title: 'Dashboard wireframe', path: 'Dashboard wireframe.excalidraw.md' },
      ],
    });

    expect(index).toContain('[[Dashboard wireframe.excalidraw.md|Dashboard wireframe]]');
    expect(index).toContain('Excalidraw artifacts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the artifact builders**

Implement pure string builders. Use this Kanban shape:

```md
---
kanban-plugin: board
---

# Dean Workflow Kanban

## Intake

- [ ] [[Canvas design palette form.md|Palette form]]
```

Use this Dataview shape:

````md
# Dean Workflow Dashboard

```dataview
TABLE status, stage, next_action, file.link AS Note
FROM ""
WHERE workflow = "design-dashboard"
SORT stage ASC, file.name ASC
```
````

Use a normal Markdown Excalidraw index linking `.excalidraw.md` files.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/community-workflows tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts
git commit -m "feat: add community workflow artifact builders"
```

---

### Task 2: Add workflow note properties for dashboards and boards

**Files:**
- Modify: `src/features/community-workflows/CommunityWorkflowArtifacts.ts`
- Test: `tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts`

**Interfaces:**
- Produces: `buildWorkflowProperties(options: WorkflowPropertiesOptions): string`
- Consumes: generated form notes from Dean workflow scaffolds

- [ ] **Step 1: Add failing property test**

```ts
import { buildWorkflowProperties } from '@/features/community-workflows';

it('builds stable workflow properties for Dataview and Kanban cards', () => {
  const props = buildWorkflowProperties({
    workflow: 'design-dashboard',
    stage: 'prototype',
    status: 'in-progress',
    agentBoard: 'Random drawing with file viewer.canvas',
    conversationId: 'conv-1',
    nextAction: 'Review prototype',
  });

  expect(props).toContain('workflow: design-dashboard');
  expect(props).toContain('stage: prototype');
  expect(props).toContain('status: in-progress');
  expect(props).toContain('agent_board: Random drawing with file viewer.canvas');
  expect(props).toContain('conversationId: conv-1');
  expect(props).toContain('next_action: Review prototype');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts`

Expected: FAIL because `buildWorkflowProperties` does not exist.

- [ ] **Step 3: Implement property builder**

Build YAML-safe lines for known scalar values. Keep the function small and do not parse arbitrary YAML.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/community-workflows/CommunityWorkflowArtifacts.ts tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts
git commit -m "feat: add workflow properties for community dashboards"
```

---

### Task 3: Build a combined community workflow scaffold

**Files:**
- Create: `src/features/community-workflows/CommunityWorkflowScaffold.ts`
- Modify: `src/features/community-workflows/index.ts`
- Test: `tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`

**Interfaces:**
- Produces: `buildCommunityWorkflowScaffold(options: CommunityWorkflowScaffoldOptions): CommunityWorkflowScaffoldResult`
- Produces files: canvas board, Kanban board, Dataview dashboard, Excalidraw index, starter Dean-session form notes

- [ ] **Step 1: Write failing scaffold test**

```ts
import { buildCommunityWorkflowScaffold } from '@/features/community-workflows';

describe('CommunityWorkflowScaffold', () => {
  it('creates canvas, kanban, dataview, and excalidraw artifacts', () => {
    const result = buildCommunityWorkflowScaffold({
      conversationId: 'conv-1',
      epoch: 0,
      createdAt: 1710000000000,
      workflow: 'design-dashboard',
    });

    expect(result.files['Dean community workflow.canvas']).toContain('Dean Workflow Kanban.md');
    expect(result.files['Dean Workflow Kanban.md']).toContain('kanban-plugin: board');
    expect(result.files['Dean Workflow Dashboard.md']).toContain('```dataview');
    expect(result.files['Dean Excalidraw Artifacts.md']).toContain('.excalidraw.md');
    expect(result.files['Dean workflow intake form.md']).toContain('```dean-session');
    expect(result.files['Dean workflow intake form.md']).toContain('conversationId: conv-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`

Expected: FAIL because `buildCommunityWorkflowScaffold` does not exist.

- [ ] **Step 3: Implement the pure scaffold builder**

Return `files: Record<string, string>`. Include these files:

- `Dean community workflow.canvas`
- `Dean Workflow Kanban.md`
- `Dean Workflow Dashboard.md`
- `Dean Excalidraw Artifacts.md`
- `Dean workflow intake form.md`
- `Dean workflow review form.md`

The canvas must contain `type: file` nodes for each artifact and edges:

```text
intake form -> kanban -> dataview dashboard -> excalidraw artifacts -> review form
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/community-workflows/CommunityWorkflowScaffold.ts src/features/community-workflows/index.ts tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts
git commit -m "feat: scaffold community plugin workflow boards"
```

---

### Task 4: Add a command to create the community workflow board

**Files:**
- Modify: `src/main.ts`
- Test: `tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`

**Interfaces:**
- Consumes: `buildCommunityWorkflowScaffold`
- Produces command: `Create Dean community workflow board`

- [ ] **Step 1: Add command behavior checklist to scaffold test**

Extend the scaffold test to assert generated filenames and stable canvas node IDs:

```ts
const canvas = JSON.parse(result.files['Dean community workflow.canvas']);
expect(canvas.nodes).toContainEqual(expect.objectContaining({ id: 'community-workflow-kanban', type: 'file' }));
expect(canvas.nodes).toContainEqual(expect.objectContaining({ id: 'community-workflow-dataview', type: 'file' }));
expect(canvas.nodes).toContainEqual(expect.objectContaining({ id: 'community-workflow-excalidraw-index', type: 'file' }));
```

- [ ] **Step 2: Run test before command wiring**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`

Expected: PASS after Task 3 if IDs already exist; otherwise FAIL and add the IDs before command wiring.

- [ ] **Step 3: Wire the command in `src/main.ts`**

Add an Obsidian command after the existing Dean commands:

```ts
this.addCommand({
  id: 'create-community-workflow-board',
  name: 'Create Dean community workflow board',
  callback: async () => {
    // Resolve current conversation when possible, otherwise create one.
    // Build scaffold with current conversationId and decoded section epoch.
    // Write only files that do not exist; for existing files, show a Notice listing skipped paths.
    // Open Dean community workflow.canvas after writes.
  },
});
```

Keep implementation in `main.ts` thin: call the scaffold builder, use `this.app.vault.adapter.exists`, `this.app.vault.create`, and `this.app.workspace.openLinkText`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/features/community-workflows tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts
git commit -m "feat: add community workflow board command"
```

---

### Task 5: Extend agent prompt guidance with community workflow possibilities

**Files:**
- Modify: `src/core/canvas-board/canvasBoardPrompt.ts`
- Test: `tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

**Interfaces:**
- Consumes: `CANVAS_BOARD_WORKFLOW_APPENDIX`
- Produces guidance for optional Kanban, Dataview, and Excalidraw artifacts

- [ ] **Step 1: Write failing prompt test**

```ts
it('mentions optional community plugin workflow surfaces', () => {
  const prompt = buildDeanSystemPromptAppendices({ enableEditorSessionSections: true }).join('

');

  expect(prompt).toContain('Kanban');
  expect(prompt).toContain('Dataview');
  expect(prompt).toContain('Excalidraw');
  expect(prompt).toContain('optional enhancements');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

Expected: FAIL until the prompt text mentions the optional surfaces.

- [ ] **Step 3: Update prompt guidance**

Add this guidance to `CANVAS_BOARD_WORKFLOW_APPENDIX`:

```text
Optional community workflow surfaces:
- Kanban: create Markdown-backed board notes that link to Dean-session form notes.
- Dataview: create dashboard notes that query workflow properties. Treat Dataview as display/query, not the writer of record.
- Excalidraw: create linked drawing artifacts for sketches and diagrams. Prefer linking files and writing instructions over mutating complex drawing internals.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/canvas-board/canvasBoardPrompt.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts
git commit -m "feat: teach agents optional community workflow surfaces"
```

---

### Task 6: Document workflow possibilities and plugin boundaries

**Files:**
- Create: `docs/community-plugin-agent-workflows.md`

**Interfaces:**
- Produces user-facing docs for what Dean can generate and what remains optional/manual

- [ ] **Step 1: Write documentation**

Create `docs/community-plugin-agent-workflows.md` with these headings:

```md
# Community Plugin Agent Workflows

## Core-first rule

## Kanban possibilities

## Dataview possibilities

## Excalidraw possibilities

## Combined Canvas board

## Optional plugin detection

## Safety boundaries

## Example generated files
```

- [ ] **Step 2: Verify headings**

Run:

```bash
rg -n "^## (Core-first rule|Kanban possibilities|Dataview possibilities|Excalidraw possibilities|Combined Canvas board|Optional plugin detection|Safety boundaries|Example generated files)" docs/community-plugin-agent-workflows.md
```

Expected: 8 matching headings.

- [ ] **Step 3: Commit**

```bash
git add docs/community-plugin-agent-workflows.md
git commit -m "docs: show community plugin workflow possibilities"
```

---

### Task 7: Verify the complete optional workflow feature

**Files:**
- No source changes in this task

**Interfaces:**
- Consumes all previous tasks
- Produces verification evidence

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/unit/features/community-workflows/CommunityWorkflowArtifacts.test.ts tests/unit/features/community-workflows/CommunityWorkflowScaffold.test.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full check**

Run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: every command exits with code 0.

- [ ] **Step 3: Manual smoke test in Obsidian**

1. Run `Create Dean community workflow board`.
2. Open `Dean community workflow.canvas`.
3. Confirm the Canvas shows file nodes for the Kanban board, Dataview dashboard, Excalidraw artifact index, and Dean-session forms.
4. If Kanban is installed, open `Dean Workflow Kanban.md` and confirm it renders as a board.
5. If Dataview is installed, open `Dean Workflow Dashboard.md` and confirm the query renders.
6. If Excalidraw is installed, open one linked `.excalidraw.md` placeholder and confirm the plugin can handle it.
7. Without those community plugins, confirm every file remains readable as plain Markdown.

---

## Self-Review

- Spec coverage: Tasks cover Kanban, Dataview, Excalidraw, Canvas composition, optionality, prompt guidance, docs, and verification.
- Placeholder scan: The plan uses concrete filenames, commands, interfaces, expected outputs, and test snippets.
- Type consistency: Artifact builder names and scaffold names are introduced before command and prompt tasks consume them.
