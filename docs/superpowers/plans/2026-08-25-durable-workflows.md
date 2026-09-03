# Durable Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-neutral, durable workflow engine that promotes only qualifying chats into asynchronous work and safely projects its status and artifacts into chat, notes, and Canvas.

**Architecture:** `src/core/workflows/` owns types, codecs, transitions, persistence and provider-run contracts. `src/app/workflows/` owns repository, scheduler, recovery, and intent resolution. Chat, note, and Canvas features consume narrow workflow ports; only target adapters write scoped Dean-owned content.

**Tech Stack:** TypeScript, Obsidian Plugin API, Jest, existing provider execution lifecycle registry, `VaultFileAdapter`, Markdown fence codecs, modular CSS.

**Spec:** `docs/superpowers/specs/2026-08-25-durable-workflows-design.md`

## Global Constraints

- Chats are not workflows by default; promotion requires a clear durable outcome, safe target, and reason to continue asynchronously.
- Core must not import features, app composition, or concrete providers. Features use core contracts/registries and never interpret opaque provider state.
- Provider transcripts remain provider-owned and read-only. Persist transitions before notifying every surface.
- Dean automatically updates only its own append-only run record/status node. Human-owned changes are immutable proposals requiring an explicit apply action.
- Invalid records, uncertain recovery, unsupported provider behavior, and unsafe targets fail closed to `needs-attention` or a proposal.
- Review provider capabilities, registration, settings, and UI per provider; never assume parity.
- Implement test-first in mirrored Jest paths and complete with `npm run typecheck && npm run lint && npm run test && npm run build`.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `src/core/workflows/Workflow.ts` | Domain types, statuses, targets, artifacts, and input snapshots |
| `src/core/workflows/WorkflowCodec.ts` | Fail-closed persistence decoder |
| `src/core/workflows/WorkflowTransitions.ts` | Immutable transition table and append-only run events |
| `src/core/workflows/WorkflowStorage.ts` | Workflow storage and provider-run contracts |
| `src/app/workflows/WorkflowStorageService.ts` | Vault I/O below `.dean/workflows/` |
| `src/app/workflows/WorkflowRepository.ts` | Ordered record writes, retry lineage, read projections |
| `src/app/workflows/WorkflowScheduler.ts` | Queue, provider-run lifecycle, cancellation, recovery |
| `src/core/workflows/WorkflowPromotion.ts` | Provider-neutral typed promotion decision contract |
| `src/app/workflows/WorkflowPromotionCoordinator.ts` | Provider-owned promotion decision routing and safe target validation |
| `src/features/chat/workflows/` | Status projection and workflow actions |
| `src/features/session-sections/workflows/` | Note-owned record/proposal projection |
| `src/features/canvas-workflows/` | Canvas ownership verification and projection |

## Task 1: Create the core workflow schema, codec, and state machine

**Files:**
- Create: `src/core/workflows/Workflow.ts`
- Create: `src/core/workflows/WorkflowCodec.ts`
- Create: `src/core/workflows/WorkflowTransitions.ts`
- Create: `src/core/workflows/WorkflowStorage.ts`
- Create: `src/core/workflows/index.ts`
- Create: `src/core/workflows/AGENTS.md`
- Test: `tests/unit/core/workflows/WorkflowCodec.test.ts`
- Test: `tests/unit/core/workflows/WorkflowTransitions.test.ts`

**Interfaces:**
- Produces `Workflow`, `WorkflowRun`, `WorkflowTarget`, `WorkflowArtifact`, `WorkflowRunStatus`, `parseWorkflowRecord`, and `transitionWorkflowRun`.
- `WorkflowRunStatus` is exactly `'queued' | 'running' | 'waiting' | 'recovering' | 'completed' | 'failed' | 'cancelled' | 'needs-attention'`.
- `transitionWorkflowRun(run, nextStatus, event)` returns a new run or throws `WorkflowTransitionError`; it never changes the input or removes events.

- [ ] **Step 1: Write the failing codec tests.**

```ts
expect(parseWorkflowRecord(JSON.stringify(validWorkflow))).toEqual(validWorkflow);
expect(() => parseWorkflowRecord('{"schemaVersion":1,"runs":[]}'))
  .toThrow(WorkflowCodecError);
expect(() => parseWorkflowRecord(JSON.stringify({
  ...validWorkflow, runs: [{ ...validRun, status: 'unknown' }],
}))).toThrow(WorkflowCodecError);
```

- [ ] **Step 2: Verify the new codec test fails.**

Run: `npm run test -- tests/unit/core/workflows/WorkflowCodec.test.ts`

Expected: FAIL because the workflow module does not yet exist.

- [ ] **Step 3: Implement the immutable types and fail-closed decoder.**

```ts
export interface WorkflowRun {
  readonly id: string;
  readonly workflowId: string;
  readonly providerId: ProviderId;
  readonly status: WorkflowRunStatus;
  readonly input: WorkflowInputSnapshot;
  readonly providerRecoveryState?: Readonly<Record<string, unknown>>;
  readonly events: readonly WorkflowRunEvent[];
  readonly artifactIds: readonly string[];
  readonly parentRunId?: string;
}

export function parseWorkflowRecord(raw: string): Workflow {
  // JSON parse; validate every field; reject invalid IDs, status values, and bounds.
}
```

- [ ] **Step 4: Write and run failing transition tests.**

```ts
expect(transitionWorkflowRun(queuedRun, 'running', startedEvent).status).toBe('running');
expect(() => transitionWorkflowRun(completedRun, 'running', startedEvent))
  .toThrow(WorkflowTransitionError);
expect(transitionWorkflowRun(failedRun, 'queued', retryEvent).events)
  .toHaveLength(failedRun.events.length + 1);
```

Run: `npm run test -- tests/unit/core/workflows/WorkflowTransitions.test.ts`

Expected: FAIL before implementation and PASS after the transition table exists.

- [ ] **Step 5: Implement only legal immutable transitions and commit.**

```ts
const ALLOWED_TRANSITIONS: Readonly<Record<WorkflowRunStatus, readonly WorkflowRunStatus[]>> = {
  queued: ['running', 'cancelled', 'needs-attention'],
  running: ['waiting', 'completed', 'failed', 'cancelled', 'needs-attention'],
  waiting: ['queued', 'cancelled', 'needs-attention'],
  recovering: ['queued', 'running', 'needs-attention', 'failed'],
  completed: [], failed: [], cancelled: [], 'needs-attention': ['queued', 'cancelled'],
};
```

Run: `npm run test -- tests/unit/core/workflows/WorkflowCodec.test.ts tests/unit/core/workflows/WorkflowTransitions.test.ts`

```bash
git add src/core/workflows tests/unit/core/workflows
git commit -m "feat: add workflow domain model"
```

## Task 2: Add durable workflow storage and repository ordering

**Files:**
- Create: `src/app/workflows/WorkflowStorageService.ts`
- Create: `src/app/workflows/WorkflowRepository.ts`
- Modify: `src/core/bootstrap/storage.ts`
- Modify: `src/core/bootstrap/storagePaths.ts`
- Modify: `src/app/storage/SharedStorageService.ts`
- Test: `tests/unit/app/workflows/WorkflowStorageService.test.ts`
- Test: `tests/unit/app/workflows/WorkflowRepository.test.ts`

**Interfaces:**
- Consumes Task 1 records and codecs.
- Produces `WorkflowRepository.create`, `get`, `list`, `transitionRun`, `appendRunEvent`, and `createRetryRun`.
- Stores records at `WORKFLOWS_PATH = '.dean/workflows'`, independent of conversations and provider transcript paths.

- [ ] **Step 1: Write the failing persistence and corrupt-record-isolation tests.**

```ts
await storage.save(workflow);
await expect(storage.load(workflow.id)).resolves.toEqual(workflow);
await adapter.write(storage.getPath('broken'), '{not json');
await expect(storage.scan()).resolves.toEqual(expect.objectContaining({ invalidCount: 1 }));
```

- [ ] **Step 2: Verify it fails, then implement the storage contract through `VaultFileAdapter`.**

Run: `npm run test -- tests/unit/app/workflows/WorkflowStorageService.test.ts`

```ts
export interface WorkflowStore {
  load(id: string): Promise<Workflow | null>;
  save(workflow: Workflow): Promise<void>;
  scan(): Promise<WorkflowScanResult>;
}
export const WORKFLOWS_PATH = '.dean/workflows';
```

- [ ] **Step 3: Write failing repository ordering/retry tests and then implement serialized writes.**

```ts
const retry = await repository.createRetryRun(workflow.id, failedRun.id);
expect(retry.parentRunId).toBe(failedRun.id);
expect(repository.get(workflow.id)?.runs).toContainEqual(failedRun);
expect(repository.get(workflow.id)?.runs).toContainEqual(retry);
```

```ts
async appendRunEvent(workflowId: string, runId: string, event: WorkflowRunEvent) {
  return this.withWorkflowWrite(workflowId, async (current) => {
    const next = appendWorkflowRunEvent(current, runId, event);
    await this.store.save(next);
    return next;
  });
}
```

- [ ] **Step 4: Run focused storage tests and commit.**

Run: `npm run test -- tests/unit/app/workflows/WorkflowStorageService.test.ts tests/unit/app/workflows/WorkflowRepository.test.ts`

```bash
git add src/core/workflows src/core/bootstrap src/app/workflows src/app/storage/SharedStorageService.ts tests/unit/app/workflows
git commit -m "feat: persist durable workflows"
```

## Task 3: Schedule isolated provider runs, cancellation, and recovery

**Files:**
- Create: `src/app/workflows/ProviderWorkflowExecutor.ts`
- Create: `src/app/workflows/WorkflowScheduler.ts`
- Modify: `src/core/execution/ProviderExecutionLifecycleRegistry.ts`
- Modify: `src/core/providers/types.ts`
- Modify: `src/core/providers/ProviderRegistry.ts`
- Modify: `src/providers/claude/capabilities.ts`
- Test: `tests/unit/app/workflows/WorkflowScheduler.test.ts`
- Test: `tests/unit/core/execution/ProviderExecutionLifecycleRegistry.test.ts`
- Test: `tests/unit/providers/claude/execution/ClaudeExecutionBackend.test.ts`

**Interfaces:**
- Produces `WorkflowScheduler.enqueue`, `cancel`, `recover`, and `shutdown`.
- Adds `'workflow'` to `ProviderExecutionOwnerKind`.
- Adds explicit optional `supportsWorkflowRecovery` and `supportsWorkflowSteer` capability fields. Omitted means false.

- [ ] **Step 1: Write a failing scheduler test with a fake provider session.**

```ts
await scheduler.enqueue(workflow.id, run.id);
await flushPromises();
expect(repository.get(workflow.id)?.runs[0]?.status).toBe('completed');
expect(fakeSession.dispose).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Verify failure, then lease an ephemeral provider session.**

Run: `npm run test -- tests/unit/app/workflows/WorkflowScheduler.test.ts`

```ts
const lease = lifecycleRegistry.acquire(backend, {
  lifecycle: 'ephemeral',
  nativePersistence: 'enabled',
  resumeSeed,
  vaultWorkingDirectory,
  interactionPort,
}, 'workflow');
const providerRun = lease.session.execute(request);
```

Persist accepted snapshots as opaque `providerRecoveryState`; append only bounded normalized event summaries and terminal artifacts.

- [ ] **Step 3: Test cancellation and unsupported recovery before implementation.**

```ts
await scheduler.cancel(workflow.id, run.id);
expect(repository.get(workflow.id)?.runs[0]?.status).toBe('cancelled');

await scheduler.recover([unsupportedRun]);
expect(getRun(unsupportedRun).status).toBe('needs-attention');
```

- [ ] **Step 4: Implement idempotent cancellation and fail-closed recovery.**

```ts
if (!ProviderRegistry.getCapabilities(run.providerId).supportsWorkflowRecovery) {
  await repository.transitionRun(workflow.id, run.id, 'needs-attention', {
    kind: 'recovery-unavailable',
    message: 'This provider cannot safely resume this workflow run.',
  });
  return;
}
```

Claude's first slice executes isolated runs but advertises recovery and steering as false until a Claude-owned native path exists and passes tests.

- [ ] **Step 5: Run the scheduler/lifecycle/provider tests and commit.**

Run: `npm run test -- tests/unit/app/workflows/WorkflowScheduler.test.ts tests/unit/core/execution/ProviderExecutionLifecycleRegistry.test.ts tests/unit/providers/claude/execution/ClaudeExecutionBackend.test.ts`

```bash
git add src/core/workflows src/core/execution src/core/providers src/app/workflows src/providers/claude tests/unit/app/workflows tests/unit/core/execution tests/unit/providers/claude
git commit -m "feat: run durable provider workflows"
```

## Task 4: Compose startup recovery and provider-owned chat promotion

**Files:**
- Create: `src/core/workflows/WorkflowPromotion.ts`
- Create: `src/app/workflows/WorkflowPromotionCoordinator.ts`
- Modify: `src/main.ts`
- Modify: `src/features/FeatureHost.ts`
- Modify: `src/features/chat/controllers/InputController.ts`
- Modify: `src/core/providers/types.ts`
- Modify: `src/core/providers/ProviderRegistry.ts`
- Create: `src/features/chat/workflows/WorkflowStatusController.ts`
- Create: `src/features/chat/workflows/WorkflowStatusChip.ts`
- Create: `src/style/features/workflows.css`
- Modify: `src/style/index.css`
- Test: `tests/unit/app/workflows/WorkflowPromotionCoordinator.test.ts`
- Test: `tests/unit/features/chat/workflows/WorkflowStatusController.test.ts`
- Test: `tests/unit/features/chat/controllers/InputController.test.ts`

**Interfaces:**
- Produces `WorkflowPromotionCoordinator.decide(request): WorkflowPromotionDecision` through the active provider's registered promotion service.
- Exposes a narrow `FeatureHost.workflows` port. `ordinary-chat` is the normal outcome; Dean never parses assistant prose or applies keyword heuristics.

- [ ] **Step 1: Write failing typed promotion-routing rules.**

```ts
await expect(coordinator.decide(chat('Explain this function')))
  .resolves.toEqual({ kind: 'ordinary-chat' });
await expect(coordinator.decide(chat('Research options and leave a brief in Project.md')))
  .resolves.toEqual(expect.objectContaining({
    kind: 'background-workflow', target: { kind: 'note', path: 'Project.md' },
  }));
expect(providerPromotionService.decide).toHaveBeenCalledWith(
  expect.objectContaining({ userRequestedBackground: false }),
);
```

- [ ] **Step 2: Verify failure, then implement promotion and lifecycle wiring.**

Run: `npm run test -- tests/unit/app/workflows/WorkflowPromotionCoordinator.test.ts`

```ts
if (decision.kind !== 'background-workflow' || !isSafeWorkflowTarget(decision.target)) return null;
const workflow = await workflows.createFromPromotion(decision);
await workflows.enqueue(workflow.id);
```

Define `WorkflowPromotionDecision` as `ordinary-chat`, `background-workflow`, or `clarification-required`. A user phrase sets `userRequestedBackground: true` and asks the provider for a decision before its normal reply; otherwise invoke the provider promotion service only after a normal response has completed. Initialize workflow services after shared storage/settings; call recovery after provider registration; drain scheduler shutdown before storage sealing. Never await a workflow's completion from a chat submission or tab close.

- [ ] **Step 3: Test tab-independent background status, then add the passive projection.**

```ts
await controller.handleAcceptedChatSubmission(backgroundEligibleRequest);
expect(statusChip.textContent).toContain('Working in background');
await tabLifecycle.close(tab);
expect(workflowScheduler.cancel).not.toHaveBeenCalled();
```

Render queued/running/waiting/needs-attention/terminal state. Expose open, cancel, retry, and retarget through the host port; do not add a normal start-workflow button or store workflows in `ChatState`.

- [ ] **Step 4: Register CSS, run focused tests, and commit.**

Run: `npm run test -- tests/unit/app/workflows/WorkflowPromotionCoordinator.test.ts tests/unit/features/chat/workflows/WorkflowStatusController.test.ts tests/unit/features/chat/controllers/InputController.test.ts`

```bash
git add src/core/workflows src/core/providers src/app/workflows src/main.ts src/features/FeatureHost.ts src/features/chat src/style/features/workflows.css src/style/index.css tests/unit/app/workflows tests/unit/features/chat
git commit -m "feat: promote durable chats to workflows"
```

## Task 5: Project append-only workflow records and proposals to notes

**Files:**
- Create: `src/features/session-sections/workflows/WorkflowNoteRecord.ts`
- Create: `src/features/session-sections/workflows/WorkflowNoteProjection.ts`
- Modify: `src/features/session-sections/SessionSectionService.ts`
- Modify: `src/features/FeatureHost.ts`
- Modify: `src/core/session-sections/SessionSection.ts`
- Modify: `src/core/session-sections/SessionSectionCodec.ts`
- Test: `tests/unit/features/session-sections/workflows/WorkflowNoteProjection.test.ts`
- Test: `tests/unit/core/session-sections/SessionSectionCodec.test.ts`

**Interfaces:**
- Accepts `workflowId` only in an explicit workflow session-section shape; existing session sections remain unchanged.
- Produces `WorkflowNoteProjection.publish(workflow)`, which returns `{ status: 'published' }` or `{ status: 'stale-target' }` and never rewrites arbitrary note ranges.

- [ ] **Step 1: Write the failing workflow-reference and unsafe-marker tests.**

```ts
expect(parseSessionSection(validWorkflowSection).workflowId).toBe('wf-123');
expect(() => parseSessionSection({ ...validWorkflowSection, workflowId: '../other' }))
  .toThrow(SessionSectionCodecError);
```

- [ ] **Step 2: Verify failure and implement the schema extension plus a stable Dean marker.**

Run: `npm run test -- tests/unit/core/session-sections/SessionSectionCodec.test.ts`

```ts
export interface WorkflowNoteRecord {
  readonly workflowId: string;
  readonly runId: string;
  readonly status: WorkflowRunStatus;
  readonly artifactIds: readonly string[];
}
```

Use a stable `<!-- dean-workflow:<workflow-id>:<run-id> -->` marker beside a bounded display block; never use it to claim user-authored prose.

- [ ] **Step 3: Test and implement stale-target/proposal behavior.**

```ts
await expect(projection.publish(workflowWithMissingMarker))
  .resolves.toEqual({ status: 'stale-target' });
expect(await repository.get(workflow.id)).toEqual(expect.objectContaining({
  artifacts: expect.arrayContaining([expect.objectContaining({ kind: 'proposal' })]),
}));
```

Re-read immediately before each write, append only when the exact Dean marker remains unique, and route section actions through `FeatureHost.workflows` rather than provider execution.

- [ ] **Step 4: Run note tests and commit.**

Run: `npm run test -- tests/unit/core/session-sections/SessionSectionCodec.test.ts tests/unit/features/session-sections/workflows/WorkflowNoteProjection.test.ts`

```bash
git add src/core/session-sections src/features/session-sections src/features/FeatureHost.ts tests/unit/core/session-sections tests/unit/features/session-sections
git commit -m "feat: publish workflow records to notes"
```

## Task 6: Add Canvas targets and Dean-owned status/result nodes

**Files:**
- Create: `src/features/canvas-workflows/CanvasWorkflowAdapter.ts`
- Create: `src/features/canvas-workflows/CanvasWorkflowProjection.ts`
- Modify: `src/features/chat/controllers/InputController.ts`
- Modify: `src/features/FeatureHost.ts`
- Test: `tests/unit/features/canvas-workflows/CanvasWorkflowAdapter.test.ts`
- Test: `tests/unit/features/canvas-workflows/CanvasWorkflowProjection.test.ts`

**Interfaces:**
- Consumes copied `CanvasSelectionContext`; the existing `CanvasSelectionController` remains read-only polling/context capture.
- Produces `readTarget`, `verifyTarget`, and `writeDeanProjection`; this adapter is the sole Canvas writer.

- [ ] **Step 1: Write failing Canvas ownership tests.**

```ts
expect(adapter.readTarget(canvasJson, ['task-1'])).toEqual(expect.objectContaining({
  canvasPath: 'Roadmap.canvas', nodeIds: ['task-1'],
}));
expect(adapter.writeDeanProjection(userOwnedNode, projection))
  .toEqual({ status: 'proposal-required' });
```

- [ ] **Step 2: Verify failure, then implement strict Dean-node identity.**

Run: `npm run test -- tests/unit/features/canvas-workflows/CanvasWorkflowAdapter.test.ts`

```ts
const deanNodeId = 'dean-workflow-' + workflow.id + '-' + run.id;
const deanNode = { id: deanNodeId, type: 'text', text: renderStatus(workflow) };
```

Require the Dean prefix/metadata marker before any update. Never modify selected user-node text, position, size, file links, or edges; represent requested changes as proposals.

- [ ] **Step 3: Test and implement stale-target reporting and chat-context hookup.**

```ts
await expect(projection.publish(workflowWithDeletedCanvasNode))
  .resolves.toEqual({ status: 'stale-target' });
expect(repository.appendRunEvent).toHaveBeenCalledWith(
  workflow.id, run.id, expect.objectContaining({ kind: 'target-stale' }),
);
```

Only use Canvas selection as a target candidate when the chat intent independently qualifies for workflow promotion.

- [ ] **Step 4: Run Canvas tests and commit.**

Run: `npm run test -- tests/unit/features/canvas-workflows/CanvasWorkflowAdapter.test.ts tests/unit/features/canvas-workflows/CanvasWorkflowProjection.test.ts`

```bash
git add src/features/canvas-workflows src/features/chat/controllers/InputController.ts src/features/FeatureHost.ts tests/unit/features/canvas-workflows
git commit -m "feat: project workflows to canvas"
```

## Task 7: Verify every provider explicitly and complete integration coverage

**Files:**
- Modify: each `src/providers/<id>/capabilities.ts` and `registration.ts`
- Modify: each owning provider execution test suite
- Create: `tests/unit/core/providers/ProviderCapabilities.test.ts`
- Create: `tests/integration/workflows/DurableWorkflowRestart.test.ts`
- Modify: `docs/features.md`
- Modify: `docs/source-map.md`

**Interfaces:**
- Consumes Task 3's capability fields.
- Each provider must advertise explicit booleans backed by a native execution test; false is the required value for unsupported recovery/steering.

- [ ] **Step 1: Write the failing capability-matrix test.**

```ts
for (const providerId of ProviderRegistry.getRegisteredProviderIds()) {
  const capabilities = ProviderRegistry.getCapabilities(providerId);
  expect(typeof capabilities.supportsWorkflowRecovery).toBe('boolean');
  expect(typeof capabilities.supportsWorkflowSteer).toBe('boolean');
}
```

- [ ] **Step 2: Verify failure, then update one provider at a time.**

Run: `npm run test -- tests/unit/core/providers/ProviderCapabilities.test.ts`

For each provider, test an isolated run's terminal mapping and test either native recovery/steering or its fail-closed unavailable result before setting the capability value.

- [ ] **Step 3: Write restart, close, concurrent publication, and collision integration tests.**

```ts
await workflowHarness.start(backgroundWorkflow);
await workflowHarness.closeDeanView();
await workflowHarness.finishProviderRun();
expect(await workflowHarness.readNoteRecord()).toContain('completed');

await workflowHarness.restartPluginDuringRun();
expect(await workflowHarness.runStatus()).toBe('needs-attention');
```

- [ ] **Step 4: Update docs only for supported behavior, run full verification, and commit.**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

```bash
git add src/providers tests/unit/providers tests/unit/core/providers tests/integration/workflows docs/features.md docs/source-map.md
git commit -m "feat: support durable workflows across providers"
```

## Plan review

- **Spec coverage:** Tasks 1-3 deliver the durable engine, provider isolation, recovery, and cancellation. Task 4 delivers provider-owned, typed background-first chat promotion. Task 5 delivers note workflows/proposals. Task 6 delivers Canvas targets/projections. Task 7 proves provider distinctions, restart/concurrency safety, and updates user documentation.
- **Placeholder scan:** Every task names its files, tests, contracts, expected test result, and commit boundary. Unsupported behavior is explicitly specified as false or `needs-attention`.
- **Type consistency:** `Workflow`, `WorkflowRun`, `WorkflowTarget`, `WorkflowArtifact`, `WorkflowRepository`, `WorkflowScheduler`, and `WorkflowPromotionCoordinator` are introduced before use and retain the same names throughout.
