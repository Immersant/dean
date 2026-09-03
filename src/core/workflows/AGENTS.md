# Workflows (core)

Provider-neutral durable workflow schema, decoding, state transitions, and execution/storage contracts.

## Ownership

- Codecs fail closed on persisted input; they never repair malformed workflow state.
- Transition helpers are the only mutators of `WorkflowRun` lifecycle and append-only events.
- Provider recovery state remains opaque in core and is decoded only by its owning provider.

## Boundaries

- Do not import `src/app/`, features, `src/main.ts`, or concrete providers.
- Provider-native sessions and transcripts are not workflow storage.

## Verification

- Unit tests mirror this folder under `tests/unit/core/workflows/`.
