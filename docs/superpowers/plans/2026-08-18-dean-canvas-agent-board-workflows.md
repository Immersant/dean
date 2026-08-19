# Dean Canvas Agent Board Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dean agents reliably use Obsidian Canvas as an interactive workflow board backed by Markdown `dean-session` form notes.

**Architecture:** Add provider-neutral canvas board utilities in `src/core/canvas-board/`, enrich canvas selection prompt context from `src/utils/canvas.ts` and `CanvasSelectionController`, extend session-section authoring guidance, and add a guarded canvas-embed action fallback in `src/features/session-sections/`. Keep form state in Markdown notes and board layout in `.canvas` JSON.

**Tech Stack:** TypeScript, Obsidian plugin APIs, Jest unit tests, Markdown, YAML, Obsidian `.canvas` JSON.

**Spec:** docs/superpowers/specs/2026-08-18-dean-canvas-agent-board-workflows-design.md

## Global Constraints

- Follow repository dependency direction from `AGENTS.md`; feature code must not import provider implementations.
- Keep session-section schema and codec ownership in `src/core/session-sections/`.
- Keep vault write-back for collect answers in `src/features/session-sections/SessionSectionWriteBack.ts`.
- Session-section Act submission must continue through `FeatureHost.submitSessionSectionTurn`.
- Do not use `console.*` in production code.
- Canvas board edits must be idempotent by stable node IDs and edge IDs.
- Agents must not edit user answers except through existing collect UI write-back.
- Community plugin support must be optional; the core workflow must work with Obsidian core Canvas and Markdown.

---

## File Structure

- Create `src/core/canvas-board/CanvasBoard.ts` for provider-neutral canvas node/edge types and narrow type guards.
- Create `src/core/canvas-board/CanvasBoardCodec.ts` for parse, serialize, selected-node resolution, and idempotent upsert helpers.
- Create `src/core/canvas-board/canvasBoardPrompt.ts` for agent-facing board workflow guidance.
- Create `src/core/canvas-board/index.ts` as the package barrel.
- Modify `src/utils/canvas.ts` to include optional selected node summaries in `<canvas_selection>` context while preserving the existing node-ID-only format when summaries are absent.
- Modify `src/features/chat/controllers/CanvasSelectionController.ts` to copy selected node summaries from Obsidian canvas selection objects.
- Modify `src/core/session-sections/sessionSectionPrompt.ts` to include canvas board workflow guidance when editor session sections are enabled.
- Modify `src/features/session-sections/SessionSectionWidget.ts` and `src/features/session-sections/SessionSectionService.ts` for canvas-embed submit fallback.
- Add tests under `tests/unit/core/canvas-board/`.
- Update tests under `tests/unit/utils/canvas.test.ts`, `tests/unit/features/chat/controllers/CanvasSelectionController.test.ts`, and `tests/unit/features/session-sections/`.
- Add documentation at `docs/canvas-agent-board-workflows.md`.

---

### Task 1: Add provider-neutral canvas board codec

**Files:**
- Create: `src/core/canvas-board/CanvasBoard.ts`
- Create: `src/core/canvas-board/CanvasBoardCodec.ts`
- Create: `src/core/canvas-board/index.ts`
- Test: `tests/unit/core/canvas-board/CanvasBoardCodec.test.ts`

**Interfaces:**
- Produces: `parseCanvasBoard(json: string): CanvasBoard`
- Produces: `serializeCanvasBoard(board: CanvasBoard): string`
- Produces: `getCanvasNode(board: CanvasBoard, nodeId: string): CanvasNode | null`
- Produces: `upsertCanvasFileNode(board: CanvasBoard, node: CanvasFileNodeInput): CanvasBoard`
- Produces: `upsertCanvasEdge(board: CanvasBoard, edge: CanvasEdgeInput): CanvasBoard`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  getCanvasNode,
  parseCanvasBoard,
  serializeCanvasBoard,
  upsertCanvasEdge,
  upsertCanvasFileNode,
} from '@/core/canvas-board';

describe('CanvasBoardCodec', () => {
  it('parses a canvas and resolves selected file nodes', () => {
    const board = parseCanvasBoard(JSON.stringify({
      nodes: [{ id: 'form', type: 'file', file: 'Canvas form.md', x: 1, y: 2, width: 300, height: 240 }],
      edges: [],
    }));

    expect(getCanvasNode(board, 'form')).toMatchObject({
      id: 'form',
      type: 'file',
      file: 'Canvas form.md',
    });
  });

  it('upserts file nodes and edges idempotently', () => {
    let board = parseCanvasBoard(JSON.stringify({ nodes: [], edges: [] }));
    board = upsertCanvasFileNode(board, {
      id: 'next-form',
      file: 'Next form.md',
      x: 100,
      y: 200,
      width: 480,
      height: 560,
      color: '3',
    });
    board = upsertCanvasFileNode(board, {
      id: 'next-form',
      file: 'Next form.md',
      x: 120,
      y: 220,
      width: 500,
      height: 600,
      color: '4',
    });
    board = upsertCanvasEdge(board, {
      id: 'edge-current-next',
      fromNode: 'current',
      fromSide: 'right',
      toNode: 'next-form',
      toSide: 'left',
      label: 'next',
      color: '4',
    });

    expect(board.nodes.filter(node => node.id === 'next-form')).toHaveLength(1);
    expect(board.nodes[0]).toMatchObject({ x: 120, width: 500, color: '4' });
    expect(board.edges).toHaveLength(1);
    expect(JSON.parse(serializeCanvasBoard(board)).nodes[0].type).toBe('file');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/core/canvas-board/CanvasBoardCodec.test.ts`

Expected: FAIL because `@/core/canvas-board` does not exist.

- [ ] **Step 3: Implement the minimal types and helpers**

```ts
// src/core/canvas-board/CanvasBoard.ts
export type CanvasNodeSide = 'top' | 'right' | 'bottom' | 'left';

export interface CanvasBaseNode {
  readonly id: string;
  readonly type: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly color?: string;
  readonly [key: string]: unknown;
}

export interface CanvasFileNode extends CanvasBaseNode {
  readonly type: 'file';
  readonly file: string;
}

export interface CanvasTextNode extends CanvasBaseNode {
  readonly type: 'text';
  readonly text: string;
}

export type CanvasNode = CanvasFileNode | CanvasTextNode | CanvasBaseNode;

export interface CanvasEdge {
  readonly id: string;
  readonly fromNode: string;
  readonly fromSide?: CanvasNodeSide;
  readonly toNode: string;
  readonly toSide?: CanvasNodeSide;
  readonly label?: string;
  readonly color?: string;
  readonly [key: string]: unknown;
}

export interface CanvasBoard {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly [key: string]: unknown;
}

export interface CanvasFileNodeInput {
  readonly id: string;
  readonly file: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color?: string;
}

export interface CanvasEdgeInput {
  readonly id: string;
  readonly fromNode: string;
  readonly fromSide?: CanvasNodeSide;
  readonly toNode: string;
  readonly toSide?: CanvasNodeSide;
  readonly label?: string;
  readonly color?: string;
}

export function isCanvasFileNode(node: CanvasNode | null | undefined): node is CanvasFileNode {
  return !!node && node.type === 'file' && typeof node.file === 'string' && node.file.length > 0;
}
```

```ts
// src/core/canvas-board/CanvasBoardCodec.ts
import type { CanvasBoard, CanvasEdgeInput, CanvasFileNodeInput, CanvasNode } from './CanvasBoard';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCanvasBoard(json: string): CanvasBoard {
  const parsed = JSON.parse(json) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Canvas board must contain nodes and edges arrays');
  }
  return parsed as CanvasBoard;
}

export function serializeCanvasBoard(board: CanvasBoard): string {
  return `${JSON.stringify(board, null, '	')}
`;
}

export function getCanvasNode(board: CanvasBoard, nodeId: string): CanvasNode | null {
  return board.nodes.find(node => node.id === nodeId) ?? null;
}

export function upsertCanvasFileNode(board: CanvasBoard, input: CanvasFileNodeInput): CanvasBoard {
  const nextNode = { id: input.id, type: 'file' as const, file: input.file, x: input.x, y: input.y, width: input.width, height: input.height, ...(input.color ? { color: input.color } : {}) };
  const nodes = board.nodes.some(node => node.id === input.id)
    ? board.nodes.map(node => node.id === input.id ? nextNode : node)
    : [...board.nodes, nextNode];
  return { ...board, nodes };
}

export function upsertCanvasEdge(board: CanvasBoard, input: CanvasEdgeInput): CanvasBoard {
  const nextEdge = { id: input.id, fromNode: input.fromNode, ...(input.fromSide ? { fromSide: input.fromSide } : {}), toNode: input.toNode, ...(input.toSide ? { toSide: input.toSide } : {}), ...(input.label ? { label: input.label } : {}), ...(input.color ? { color: input.color } : {}) };
  const edges = board.edges.some(edge => edge.id === input.id)
    ? board.edges.map(edge => edge.id === input.id ? nextEdge : edge)
    : [...board.edges, nextEdge];
  return { ...board, edges };
}
```

```ts
// src/core/canvas-board/index.ts
export * from './CanvasBoard';
export * from './CanvasBoardCodec';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/core/canvas-board/CanvasBoardCodec.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/canvas-board tests/unit/core/canvas-board/CanvasBoardCodec.test.ts
git commit -m "feat: add canvas board codec"
```

---

### Task 2: Enrich canvas selection prompt context with selected node summaries

**Files:**
- Modify: `src/utils/canvas.ts`
- Modify: `src/features/chat/controllers/CanvasSelectionController.ts`
- Test: `tests/unit/utils/canvas.test.ts`
- Test: `tests/unit/features/chat/controllers/CanvasSelectionController.test.ts`

**Interfaces:**
- Consumes: existing `CanvasSelectionContext`
- Produces: optional `CanvasSelectionContext.nodes?: CanvasSelectionNodeSummary[]`
- Produces: `formatCanvasContext` output that remains backward-compatible when `nodes` is absent

- [ ] **Step 1: Write the failing tests**

```ts
import { formatCanvasContext } from '@/utils/canvas';

describe('canvas utilities selected node summaries', () => {
  it('includes selected file node summaries when provided', () => {
    expect(formatCanvasContext({
      canvasPath: 'Board.canvas',
      nodeIds: ['form-1'],
      nodes: [{ id: 'form-1', type: 'file', file: 'Form.md' }],
    })).toContain('id: form-1
type: file
file: Form.md');
  });

  it('keeps the old compact format when summaries are absent', () => {
    expect(formatCanvasContext({ canvasPath: 'Board.canvas', nodeIds: ['form-1'] }))
      .toContain('<![CDATA[form-1]]>');
  });
});
```

Add this behavior test to `CanvasSelectionController.test.ts`:

```ts
it('captures selected canvas file node summaries', () => {
  canvasView.canvas.selection = new Set([{ id: 'form-1', type: 'file', file: 'Form.md' }]);

  controller.start();
  jest.advanceTimersByTime(250);

  expect(controller.getContext()).toEqual({
    canvasPath: 'my-canvas.canvas',
    nodeIds: ['form-1'],
    nodes: [{ id: 'form-1', type: 'file', file: 'Form.md' }],
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/utils/canvas.test.ts tests/unit/features/chat/controllers/CanvasSelectionController.test.ts`

Expected: FAIL because `nodes` summaries are not captured or formatted.

- [ ] **Step 3: Implement minimal enrichment**

```ts
// src/utils/canvas.ts
export interface CanvasSelectionNodeSummary {
  id: string;
  type?: string;
  file?: string;
  text?: string;
}

export interface CanvasSelectionContext {
  canvasPath: string;
  nodeIds: string[];
  nodes?: CanvasSelectionNodeSummary[];
}
```

Update `formatCanvasContext` so it emits the original body when `nodes` is absent, and emits readable summaries when `nodes` exists:

```ts
const body = context.nodes?.length
  ? context.nodes.map(node => [
    `id: ${node.id}`,
    node.type ? `type: ${node.type}` : '',
    node.file ? `file: ${node.file}` : '',
    node.text ? `text: ${node.text.slice(0, 200)}` : '',
  ].filter(Boolean).join('
')).join('
---
')
  : context.nodeIds.join(', ');
```

In `CanvasSelectionController`, map selected node objects into summaries without reading files during polling:

```ts
const nodes = [...selection].flatMap(node => {
  if (typeof node.id !== 'string' || node.id.length === 0) return [];
  const summary: CanvasSelectionNodeSummary = { id: node.id };
  if (typeof (node as { type?: unknown }).type === 'string') summary.type = (node as { type: string }).type;
  if (typeof (node as { file?: unknown }).file === 'string') summary.file = (node as { file: string }).file;
  if (typeof (node as { text?: unknown }).text === 'string') summary.text = (node as { text: string }).text;
  return [summary];
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/utils/canvas.test.ts tests/unit/features/chat/controllers/CanvasSelectionController.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/canvas.ts src/features/chat/controllers/CanvasSelectionController.ts tests/unit/utils/canvas.test.ts tests/unit/features/chat/controllers/CanvasSelectionController.test.ts
git commit -m "feat: include canvas node summaries in prompts"
```

---

### Task 3: Add canvas board workflow guidance to session-section prompt appendix

**Files:**
- Create: `src/core/canvas-board/canvasBoardPrompt.ts`
- Modify: `src/core/canvas-board/index.ts`
- Modify: `src/core/session-sections/sessionSectionPrompt.ts`
- Test: `tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

**Interfaces:**
- Produces: `CANVAS_BOARD_WORKFLOW_APPENDIX: string`
- Consumes: `buildDeanSystemPromptAppendices(settings, toolPolicy?)`

- [ ] **Step 1: Write the failing test**

```ts
import { buildDeanSystemPromptAppendices } from '@/core/session-sections/sessionSectionPrompt';

describe('canvas board workflow prompt appendix', () => {
  it('teaches agents how to use canvas selections as workflow boards', () => {
    const appendices = buildDeanSystemPromptAppendices({ enableEditorSessionSections: true });
    const prompt = appendices.join('

');

    expect(prompt).toContain('Canvas Board Workflows');
    expect(prompt).toContain('Canvas is the board');
    expect(prompt).toContain('Markdown notes are the forms');
    expect(prompt).toContain('type: file');
    expect(prompt).toContain('Validate the canvas JSON');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

Expected: FAIL because no canvas board workflow appendix exists.

- [ ] **Step 3: Implement the prompt appendix**

```ts
// src/core/canvas-board/canvasBoardPrompt.ts
export const CANVAS_BOARD_WORKFLOW_APPENDIX = `## Canvas Board Workflows

When a user provides a <canvas_selection> tag, treat the canvas as a visual workflow board.

Rules:
- Canvas is the board: use nodes for stages, forms, outputs, decisions, and artifacts.
- Markdown notes are the forms: use type: file canvas nodes pointing to .md files with dean-session fences.
- If a selected canvas node is a file node, read the linked Markdown file before acting.
- If the linked note contains a dean-session collect fence, read the answers mapping but do not edit user answers.
- Write outputs under the requested heading in the linked note.
- When advancing a workflow, create follow-up Markdown form notes and add them to the canvas as type: file nodes.
- Use stable node IDs and edge IDs so repeated runs update existing board elements instead of duplicating them.
- Validate the canvas JSON after editing a .canvas file.
- Community plugins such as Dataview, Tasks, Bases, Meta Bind, or Advanced URI are optional; never require them for the core flow.
`;
```

Append it from `sessionSectionPrompt.ts` when editor session sections are enabled and tool policy is not passive/read-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/core/session-sections/sessionSectionPrompt.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/canvas-board/canvasBoardPrompt.ts src/core/canvas-board/index.ts src/core/session-sections/sessionSectionPrompt.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts
git commit -m "feat: guide agents through canvas board workflows"
```

---

### Task 4: Add canvas-embed action fallback for session-section Act clicks

**Files:**
- Modify: `src/features/session-sections/SessionSectionWidget.ts`
- Modify: `src/features/session-sections/SessionSectionService.ts`
- Test: `tests/unit/features/session-sections/SessionSectionService.test.ts`
- Test: `tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts`

**Interfaces:**
- Consumes: `activateSessionSectionAction(options)`
- Produces: `skipConfirm?: boolean` option for trusted canvas embed fallback
- Produces: `isInsideCanvasEmbed(el: HTMLElement): boolean`

- [ ] **Step 1: Write failing service test**

```ts
it('submits without confirmation when skipConfirm is true', async () => {
  const submit = jest.fn().mockResolvedValue({ status: 'sent' });
  const host = {
    app: {},
    getConversationSync: jest.fn().mockReturnValue({ id: 'conv-1', title: 'Test' }),
    getConversationById: jest.fn(),
    submitSessionSectionTurn: submit,
  } as unknown as FeatureHost;

  const result = await activateSessionSectionAction({
    host,
    source: VALID_ACT,
    notePath: 'Notes/Spec.md',
    actionId: 'review',
    skipConfirm: true,
  });

  expect(result).toEqual({ status: 'sent' });
  expect(confirmSessionSectionAction).not.toHaveBeenCalled();
  expect(submit).toHaveBeenCalledWith('conv-1', expect.objectContaining({ canonicalText: 'Review this note carefully.' }));
});
```

- [ ] **Step 2: Write failing widget test**

```ts
it('detects canvas embeds and activates collect actions with skipConfirm', async () => {
  const canvasContainer = createMockEl() as any;
  canvasContainer.classList.add('canvas-node-content');
  const el = createMockEl() as unknown as HTMLElement;
  canvasContainer.appendChild(el as unknown as Node);

  renderSessionSectionWidget({ host, containerEl: el, source: BODY, notePath: 'Notes/Spec.md', section: SECTION, ctx });

  findButton(el).click();
  for (let i = 0; i < 20 && jest.mocked(activateSessionSectionAction).mock.calls.length === 0; i++) {
    await Promise.resolve();
  }

  expect(activateSessionSectionAction).toHaveBeenCalledWith(expect.objectContaining({ skipConfirm: true }));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/unit/features/session-sections/SessionSectionService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts`

Expected: FAIL because `skipConfirm` and canvas embed detection do not exist.

- [ ] **Step 4: Implement minimal fallback**

Add optional `skipConfirm?: boolean` to `ActivateSessionSectionActionOptions`.

In `activateSessionSectionAction`, keep all validation and action lookup. Bypass only the modal:

```ts
const confirmed = options.skipConfirm
  ? true
  : await confirmSessionSectionAction(host.app, { conversationTitle, conversationArchived: conversation?.isArchived === true, notePath, actionLabel: action.label, prompt: action.prompt, stale: section.status === 'stale' });
```

Add a narrow DOM helper in `SessionSectionWidget.ts`:

```ts
export function isInsideCanvasEmbed(el: HTMLElement): boolean {
  return !!el.closest?.('.canvas-node, .canvas-node-content, .canvas-wrapper');
}
```

Pass `skipConfirm: isInsideCanvasEmbed(containerEl)` when calling `activateSessionSectionAction`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/unit/features/session-sections/SessionSectionService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/session-sections/SessionSectionWidget.ts src/features/session-sections/SessionSectionService.ts tests/unit/features/session-sections/SessionSectionService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts
git commit -m "feat: submit canvas session actions without modal"
```

---

### Task 5: Add workflow scaffold command for a starter canvas board

**Files:**
- Create: `src/features/canvas-workflows/CanvasWorkflowScaffold.ts`
- Create: `src/features/canvas-workflows/index.ts`
- Modify: `src/main.ts`
- Test: `tests/unit/features/canvas-workflows/CanvasWorkflowScaffold.test.ts`

**Interfaces:**
- Produces: `buildCanvasWorkflowScaffold(options: CanvasWorkflowScaffoldOptions): CanvasWorkflowScaffoldResult`
- Produces: Markdown strings for starter `dean-session` collect notes
- Produces: Canvas JSON string for a starter board

- [ ] **Step 1: Write failing scaffold test**

```ts
import { buildCanvasWorkflowScaffold } from '@/features/canvas-workflows';

describe('CanvasWorkflowScaffold', () => {
  it('creates a starter board with linked dean-session form notes', () => {
    const result = buildCanvasWorkflowScaffold({
      conversationId: 'conv-123',
      epoch: 0,
      createdAt: 1710000000000,
      boardPath: 'Canvas workflow board.canvas',
    });

    expect(result.files['Canvas workflow intake form.md']).toContain('```dean-session');
    expect(result.files['Canvas workflow intake form.md']).toContain('conversationId: conv-123');
    const board = JSON.parse(result.files['Canvas workflow board.canvas']);
    expect(board.nodes).toContainEqual(expect.objectContaining({ type: 'file', file: 'Canvas workflow intake form.md' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/features/canvas-workflows/CanvasWorkflowScaffold.test.ts`

Expected: FAIL because the scaffold module does not exist.

- [ ] **Step 3: Implement scaffold builder without vault writes**

Implement a pure function returning `{ files: Record<string, string> }`. Keep actual vault writes in `main.ts` command callback so the builder is easy to test.

- [ ] **Step 4: Register a command in `src/main.ts`**

Add command name: `Create Dean canvas workflow board`.

Command behavior:

1. Require editor session sections enabled; otherwise show a Notice.
2. Create a new conversation or use current conversation when available.
3. Write the starter `.canvas` and `.md` files if they do not exist.
4. Open the board file in Obsidian.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/unit/features/canvas-workflows/CanvasWorkflowScaffold.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas-workflows src/main.ts tests/unit/features/canvas-workflows/CanvasWorkflowScaffold.test.ts
git commit -m "feat: scaffold Dean canvas workflow boards"
```

---

### Task 6: Document core and optional community-plugin workflow patterns

**Files:**
- Create: `docs/canvas-agent-board-workflows.md`
- Test: no automated test; verify links and headings by inspection

**Interfaces:**
- Consumes: implemented behavior from Tasks 1-5
- Produces: user-facing guidance for Canvas, Markdown forms, Properties, Bases/Dataview, Tasks, Templates/Templater, Meta Bind, Advanced URI, and Excalidraw boundaries

- [ ] **Step 1: Write the documentation**

Create `docs/canvas-agent-board-workflows.md` with these headings:

```md
# Canvas Agent Board Workflows

## Core pattern

## How Dean reads a selected canvas node

## How to structure Markdown form notes

## How agents should advance a board

## Properties to add to workflow notes

## Optional Bases or Dataview dashboards

## Optional Tasks output

## Optional Advanced URI and workspace links

## Excalidraw boundary

## Safety rules
```

- [ ] **Step 2: Verify the documentation has all required headings**

Run:

```bash
rg -n "^## (Core pattern|How Dean reads|How to structure|How agents should advance|Properties|Optional Bases|Optional Tasks|Optional Advanced URI|Excalidraw boundary|Safety rules)" docs/canvas-agent-board-workflows.md
```

Expected: 10 matching headings.

- [ ] **Step 3: Commit**

```bash
git add docs/canvas-agent-board-workflows.md
git commit -m "docs: describe canvas agent board workflows"
```

---

### Task 7: Run focused and full verification

**Files:**
- No source files created in this task
- Verification only

**Interfaces:**
- Consumes: all previous tasks
- Produces: evidence that the feature is safe to merge

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- tests/unit/core/canvas-board/CanvasBoardCodec.test.ts tests/unit/utils/canvas.test.ts tests/unit/features/chat/controllers/CanvasSelectionController.test.ts tests/unit/core/session-sections/sessionSectionPrompt.test.ts tests/unit/features/session-sections/SessionSectionService.test.ts tests/unit/features/session-sections/SessionSectionWidget.collect.test.ts tests/unit/features/canvas-workflows/CanvasWorkflowScaffold.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 2: Run default full check**

Run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: every command exits with code 0.

- [ ] **Step 3: Manual smoke test in Obsidian**

1. Enable editor session sections.
2. Run `Create Dean canvas workflow board`.
3. Open the generated canvas.
4. Select the starter file node.
5. Ask Dean to continue the workflow.
6. Confirm the agent reads the selected file node and writes only the requested output section.
7. Confirm follow-up file nodes are created as `type: file` nodes and connected with labeled edges.
8. Confirm repeated submissions update the same nodes and edges instead of duplicating them.

- [ ] **Step 4: Commit verification notes if useful**

If manual smoke notes are worth keeping, write them to `.context/canvas-agent-board-smoke.md` and commit only if the team wants durable verification notes in the branch.

---

## Self-Review

- Spec coverage: Tasks 1-5 cover canvas parsing, selected-node context, system guidance, canvas embed action fallback, and starter board scaffolding. Task 6 covers documentation and optional plugin patterns. Task 7 covers verification.
- Placeholder scan: The plan avoids open-ended implementation placeholders and gives concrete filenames, interfaces, tests, commands, and expected outcomes.
- Type consistency: `CanvasBoard`, `CanvasNode`, `CanvasSelectionContext.nodes`, `skipConfirm`, and scaffold interfaces are introduced before later tasks consume them.
