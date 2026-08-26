import {
  type Workflow,
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowArtifact,
  type WorkflowInputSnapshot,
  type WorkflowRun,
  type WorkflowRunEvent,
  type WorkflowRunEventKind,
  type WorkflowRunStatus,
  type WorkflowTarget,
} from './Workflow';

const WORKFLOW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const WORKFLOW_EVENT_KINDS: ReadonlySet<WorkflowRunEventKind> = new Set([
  'started',
  'completed',
  'failed',
  'cancelled',
  'recovery-unavailable',
  'target-stale',
]);
const WORKFLOW_RUN_STATUS_SET: ReadonlySet<string> = new Set(WORKFLOW_RUN_STATUSES);

export class WorkflowCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowCodecError';
  }
}

export function parseWorkflowRecord(raw: string): Workflow {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new WorkflowCodecError('Workflow record must be valid JSON.');
  }

  const record = requireRecord(value, 'Workflow record');
  if (record.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
    throw new WorkflowCodecError('Workflow record has an unsupported schema version.');
  }

  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    id: requireId(record.id, 'Workflow id'),
    title: requireText(record.title, 'Workflow title'),
    createdAt: requireTimestamp(record.createdAt, 'Workflow creation time'),
    updatedAt: requireTimestamp(record.updatedAt, 'Workflow update time'),
    targets: requireArray(record.targets, 'Workflow targets').map(decodeTarget),
    runs: requireArray(record.runs, 'Workflow runs').map(decodeRun),
    artifacts: requireArray(record.artifacts, 'Workflow artifacts').map(decodeArtifact),
  };
}

function decodeRun(value: unknown): WorkflowRun {
  const record = requireRecord(value, 'Workflow run');
  return {
    id: requireId(record.id, 'Workflow run id'),
    workflowId: requireId(record.workflowId, 'Workflow run workflow id'),
    providerId: requireText(record.providerId, 'Workflow run provider id'),
    status: decodeRunStatus(record.status),
    createdAt: requireTimestamp(record.createdAt, 'Workflow run creation time'),
    input: decodeInput(record.input),
    ...(record.providerRecoveryState === undefined
      ? {}
      : { providerRecoveryState: requireRecord(record.providerRecoveryState, 'Workflow recovery state') }),
    events: requireArray(record.events, 'Workflow run events').map(decodeEvent),
    artifactIds: requireArray(record.artifactIds, 'Workflow run artifact ids')
      .map(value => requireId(value, 'Workflow run artifact id')),
    ...(record.parentRunId === undefined
      ? {}
      : { parentRunId: requireId(record.parentRunId, 'Workflow parent run id') }),
  };
}

function decodeInput(value: unknown): WorkflowInputSnapshot {
  const record = requireRecord(value, 'Workflow input');
  return {
    prompt: requireText(record.prompt, 'Workflow prompt'),
    targets: requireArray(record.targets, 'Workflow input targets').map(decodeTarget),
  };
}

function decodeTarget(value: unknown): WorkflowTarget {
  const record = requireRecord(value, 'Workflow target');
  const role = decodeRole(record.role);
  const path = requireText(record.path, 'Workflow target path');
  if (record.kind === 'note') {
    return {
      kind: 'note',
      path,
      role,
      ...(record.sectionId === undefined
        ? {}
        : { sectionId: requireId(record.sectionId, 'Workflow target section id') }),
    };
  }
  if (record.kind === 'canvas') {
    return {
      kind: 'canvas',
      path,
      role,
      nodeIds: requireArray(record.nodeIds, 'Workflow target node ids')
        .map(value => requireId(value, 'Workflow target node id')),
    };
  }
  throw new WorkflowCodecError('Workflow target kind is invalid.');
}

function decodeArtifact(value: unknown): WorkflowArtifact {
  const record = requireRecord(value, 'Workflow artifact');
  if (record.kind !== 'display' && record.kind !== 'proposal') {
    throw new WorkflowCodecError('Workflow artifact kind is invalid.');
  }
  return {
    id: requireId(record.id, 'Workflow artifact id'),
    workflowId: requireId(record.workflowId, 'Workflow artifact workflow id'),
    runId: requireId(record.runId, 'Workflow artifact run id'),
    kind: record.kind,
    createdAt: requireTimestamp(record.createdAt, 'Workflow artifact creation time'),
  };
}

function decodeEvent(value: unknown): WorkflowRunEvent {
  const record = requireRecord(value, 'Workflow run event');
  if (typeof record.kind !== 'string' || !WORKFLOW_EVENT_KINDS.has(record.kind as WorkflowRunEventKind)) {
    throw new WorkflowCodecError('Workflow run event kind is invalid.');
  }
  return {
    at: requireTimestamp(record.at, 'Workflow run event time'),
    kind: record.kind as WorkflowRunEventKind,
    message: requireText(record.message, 'Workflow run event message'),
  };
}

function decodeRunStatus(value: unknown): WorkflowRunStatus {
  if (typeof value !== 'string' || !WORKFLOW_RUN_STATUS_SET.has(value)) {
    throw new WorkflowCodecError('Workflow run status is invalid.');
  }
  return value as WorkflowRunStatus;
}

function decodeRole(value: unknown): 'input' | 'publication' | 'both' {
  if (value === 'input' || value === 'publication' || value === 'both') return value;
  throw new WorkflowCodecError('Workflow target role is invalid.');
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkflowCodecError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new WorkflowCodecError(`${label} must be an array.`);
  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new WorkflowCodecError(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireId(value: unknown, label: string): string {
  const id = requireText(value, label);
  if (!WORKFLOW_ID_PATTERN.test(id)) throw new WorkflowCodecError(`${label} is invalid.`);
  return id;
}

function requireTimestamp(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new WorkflowCodecError(`${label} must be a non-negative timestamp.`);
  }
  return value;
}
