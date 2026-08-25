# Durable workflows design

## Goal

Make Dean an asynchronous workflow collaborator. A person can express work in chat, a workflow note, or a Canvas selection; Dean resolves that context to one durable workflow, runs independent work in the background, and leaves a readable session and artifact trail in the vault.

The system serves both a personal vault and collaboration through shared notes and Canvas. It must remain useful when Dean is closed, when a provider cannot resume, and when people edit targets while runs are active.

## Decisions

- Use one shared, provider-neutral durable workflow engine. Do not make conversations, Markdown fences, or Canvas metadata the sole workflow authority.
- Treat chat, notes, and Canvas as native entry and inspection surfaces over that engine.
- Start work in the background when intent, outcome, and target are unambiguous. Do not put a dedicated launch button in the normal path.
- Run independent workflows concurrently, bounded by provider/process capacity. Each run owns its own provider session and output trail.
- Automatically update only Dean-owned append-only run records and status presentation. Changes to human-authored content are proposals that require an explicit apply action.
- Keep provider-native session data and transcripts provider-owned and read-only. Dean persists only the provider-approved opaque recovery/snapshot data.
- Recover unfinished work fail-closed: provider-owned recovery decides whether a run can resume; uncertain runs require attention rather than being silently replayed.

## Existing foundations

The design extends, rather than replaces, these existing areas:

- `src/core/execution/` already owns provider-neutral sessions, requests, events, interaction, snapshots, and lifecycle fencing.
- `src/app/conversations/` owns Dean conversation persistence while provider transcript files remain read-only replay sources.
- `src/features/chat/` owns per-tab presentation and background-work sequencing, but runtime tabs are deliberately not durable.
- `src/core/session-sections/` and `src/features/session-sections/` provide typed, fail-closed editor forms/actions and controlled Markdown write-back.
- `src/core/artifacts/` and `src/features/artifacts/` provide safe, display-only artifact blocks.
- `CanvasSelectionController` provides safe selected-node context but does not own Canvas-file mutation.

## Architecture

```text
Chat prompt / workflow note / Canvas selection
                    |
                    v
         Workflow intent resolver
                    |
                    v
      Durable WorkflowRepository (application scope)
                    |
          +---------+---------+
          |                   |
          v                   v
 WorkflowScheduler       Surface projections
          |              note run record / Canvas status
          v
 Provider workflow-run executor
          |
          v
 Provider-owned session and transcript
```

`WorkflowRepository` is the source of truth for Dean-owned workflow metadata. It persists metadata and an append-only run timeline through an application-owned storage contract. It does not parse provider transcripts, drive DOM, or mutate target files directly.

`WorkflowScheduler` admits queued work, observes provider and configured capacity, and serializes state transitions for each run. It does not own provider-native protocol behavior; it delegates execution and recovery through a provider-neutral workflow-run contract registered by providers that support it.

Surface adapters translate workflow intent into requests and project state back into the vault. They call explicit repository/scheduler contracts; no feature imports provider implementations.

## Domain model

### Workflow

One durable work item shared by all surfaces:

- `id`, schema version, title, creation and update timestamps
- `status`: a readable aggregate of its runs
- immutable initial intent and normalized targets
- references to run IDs and durable artifact IDs
- creation provenance: chat, note, or Canvas

### WorkflowRun

One asynchronous execution attempt:

- `id`, `workflowId`, provider ID, selected model, timestamps
- sanitized immutable input snapshot and target snapshot
- lifecycle: `queued`, `running`, `waiting`, `recovering`, `completed`, `failed`, `cancelled`, or `needs-attention`
- opaque provider-owned resume/recovery state, decoded only by its owning provider
- append-only event summary, terminal outcome, and artifact references
- optional parent run ID for retries

The run's session is independent from a chat tab. A chat surface may observe or steer a supported live run, but closing the view must not cancel it.

### WorkflowTarget

A stable reference to a work surface rather than its mutable content:

- Markdown note path plus an optional Dean-owned block/section identity
- Canvas path plus node ID(s) and the last known safe node summary
- target role: input, publication location, or both

Targets retain the last known reference when renamed, deleted, or changed. They become `stale` when safe publication cannot continue and require retargeting.

### Artifact and proposal

An artifact is a durable result referenced from a run. It is either:

- a Dean-owned display/run record that can be appended automatically; or
- an immutable proposal to change human-owned note or Canvas content.

Artifacts are not provider transcripts. Existing `dean-artifact` blocks remain display-only; interactive confirmation and apply controls use an explicit feature-owned workflow artifact surface or the existing session-section action path.

## Background-first initiation

Dean creates or continues a workflow without a launch ceremony when all of the following are true:

1. The request has a recognizable outcome.
2. A safe target is explicit or unambiguously inferred from the current linked note or Canvas selection.
3. Starting does not itself edit human-owned content or introduce unapproved external side effects.

Examples:

- A chat request to research options and leave a decision brief in the current project note creates a background run and displays a compact status chip.
- An authored workflow note section with completed inputs resolves its next action and queues or continues its associated workflow.
- A chat request made with Canvas nodes selected scopes a workflow to those nodes and creates Dean-owned status/result nodes at the defined publication location.

Dean asks a minimal provider-native or feature-owned clarification only for ambiguous targets, external side effects, missing permissions, or a missing decision. Controls are secondary actions: open, pause, cancel, retry, retarget, attach, and apply proposal.

## Surface behavior

### Chat

Chat captures intent, presents compact live status, and provides a way to inspect or steer a supporting provider run. It must not become the workflow's persistence boundary. Provider steering remains capability-gated.

### Workflow notes

Notes contain normal human-readable Markdown and existing `dean-session` controls for structured input/review. Dean creates a separately identifiable, append-only run record and can render safe display artifacts. It must not replace human-authored prose, forms, or arbitrary fences.

### Canvas

Canvas selection supplies scope. The workflow adapter may create or update only clearly Dean-owned status/result nodes and edges. Any change to user-created node text, layout, connections, or file content is a proposal. Canvas mutation uses a dedicated, tested Obsidian adapter rather than the polling selection controller.

## Lifecycle and recovery

1. Intent resolution creates a `Workflow` and a `queued` `WorkflowRun` in one durable operation.
2. The scheduler claims the run, persists `running`, asks the provider adapter to establish an owned session, then persists the accepted recovery state.
3. Provider events append bounded summaries and create/update artifacts. The repository persists each state transition before notifying surface projections.
4. Completion, cancellation, interaction wait, and failure are terminal/paused transitions with durable diagnostic summaries.
5. Plugin startup loads non-terminal runs as `recovering`. The owning provider adapter decides whether exact resumption is supported with the persisted opaque state.
6. A safely resumable run returns to `queued` or `running` under scheduler control. An unavailable or uncertain run becomes `needs-attention` with a reason and a Retry action.
7. Retry creates a new run with a parent reference. It never mutates or erases the prior run.

No recovery path may reconstruct a provider session ID, transcript, or request semantics in core or feature code. A provider without workflow-run recovery support fails closed to `needs-attention`.

## Collaboration and conflict rules

- Dean-owned append-only records include stable workflow/run IDs and can be located independently of surrounding prose.
- Note and Canvas projection adapters re-read and validate their target before every write. They apply only a scoped append/update to a Dean-owned location.
- If a target has moved, was deleted, is malformed, or no longer has a uniquely safe Dean-owned location, the adapter marks its target stale and produces a proposal rather than attempting a broad rewrite.
- Two people may edit the same target. The underlying vault's last-write behavior is not treated as a merge system; a write mismatch becomes a durable conflict/attention event.
- Provider-native transcripts are never mutated or deleted as a consequence of workflow state, target changes, cancellation, or retries.

## Provider integration

Add explicit provider-neutral contracts and registry capability flags for:

- establishing an isolated workflow-run execution
- optional live steering
- optional safe recovery from provider-owned opaque run state
- capability/diagnostic reporting when a provider does not support one of these behaviors

Each provider registration, capability definition, settings reconciliation path, and UI config must be reviewed individually. Do not assume Claude, Codex, Grok, OpenCode, and Pi have equivalent process, resume, steering, permission, or interaction semantics.

## Ownership and dependencies

| Area | Responsibility |
| --- | --- |
| `src/core/workflows/` | Provider-neutral workflow types, validation, state machine, storage/execution contracts, and transition helpers |
| `src/app/workflows/` | Repository, scheduler composition, persistence coordination, target registration, and startup recovery coordination |
| `src/providers/<id>/` | Provider-owned isolated run executor, recovery decoder, native session state, and capability advertisement |
| `src/features/chat/` | Intent capture, status chips, workflow inspection and capability-gated steering |
| `src/features/session-sections/` | Workflow-note input/review orchestration and scoped record/proposal presentation |
| `src/features/canvas-workflows/` | Canvas command/projection adapter and safe target validation |
| `src/main.ts` | Lifecycle wiring, registrations, startup/shutdown coordination, and commands |

Core must not import features, app composition, or concrete providers. Features must resolve workflow execution through core registries/contracts and must not inspect opaque provider state.

## Error handling

- Invalid persisted workflow metadata is decoded fail-closed and isolated from unrelated workflows.
- A provider start/recovery failure records a sanitized diagnostic summary and transitions the run to `failed` or `needs-attention` as appropriate.
- Scheduler cancellation is idempotent and never deletes state.
- Projection failure does not discard a completed result; it marks the target stale and leaves the artifact available from workflow inspection.
- A blocked provider interaction moves the run to `waiting`; it resumes only through the provider-approved interaction path.

## Verification

- Core unit tests cover codecs, state transitions, append-only event timelines, concurrent-run admission, cancellation, and recovery classification.
- Application tests cover persistence ordering, restart rehydration, scheduler capacity, stale-target handling, and retry lineage.
- Provider tests cover each adapter's isolated launch/recovery/steering capabilities and explicitly verify unsupported paths fail closed.
- Feature tests cover chat initiation/status, note-owned record append/proposal behavior, Canvas target projection, conflict detection, and no mutation of human-owned material.
- Integration tests cover a completed background run after sidebar closure, plugin restart during an active run, failed recovery, and two workflows publishing to distinct targets concurrently.
- The repository's full check remains `npm run typecheck && npm run lint && npm run test && npm run build` once implementation begins.

## Non-goals for the first implementation

- A general workflow language, arbitrary DAG executor, cron/scheduled tasks, or cross-device synchronization protocol.
- Automatic merging of concurrent human edits.
- Direct editing/deletion of provider-native histories or transcripts.
- Treating all providers as feature-equivalent.
- Arbitrary automatic execution of external side effects.

## Delivery slices

1. Durable core model, repository, scheduler, and provider-neutral contracts; no user-visible automatic initiation yet.
2. One provider's isolated workflow-run adapter plus startup recovery and a chat status/inspection surface.
3. Workflow-note records, artifact proposals, and safe session-section entry.
4. Canvas workflow target/projection adapter with explicit ownership markers.
5. Additional provider adapters, capability-specific UI, and full interruption/collaboration coverage.
