import type { ProviderId } from '../types/provider';

export const WORKFLOW_SCHEMA_VERSION = 1 as const;

export const WORKFLOW_RUN_STATUSES = [
  'queued',
  'running',
  'waiting',
  'recovering',
  'completed',
  'failed',
  'cancelled',
  'needs-attention',
] as const;

export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

export type WorkflowTarget =
  | {
      readonly kind: 'note';
      readonly path: string;
      readonly role: 'input' | 'publication' | 'both';
      readonly sectionId?: string;
    }
  | {
      readonly kind: 'canvas';
      readonly path: string;
      readonly nodeIds: readonly string[];
      readonly role: 'input' | 'publication' | 'both';
    };

export interface WorkflowInputSnapshot {
  readonly prompt: string;
  readonly targets: readonly WorkflowTarget[];
}

export type WorkflowRunEventKind =
  | 'started'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovery-unavailable'
  | 'target-stale';

export interface WorkflowRunEvent {
  readonly at: number;
  readonly kind: WorkflowRunEventKind;
  readonly message: string;
}

export interface WorkflowRun {
  readonly id: string;
  readonly workflowId: string;
  readonly providerId: ProviderId;
  readonly status: WorkflowRunStatus;
  readonly createdAt: number;
  readonly input: WorkflowInputSnapshot;
  readonly providerRecoveryState?: Readonly<Record<string, unknown>>;
  readonly events: readonly WorkflowRunEvent[];
  readonly artifactIds: readonly string[];
  readonly parentRunId?: string;
}

export interface WorkflowArtifact {
  readonly id: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly kind: 'display' | 'proposal';
  readonly createdAt: number;
}

export interface Workflow {
  readonly schemaVersion: typeof WORKFLOW_SCHEMA_VERSION;
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly targets: readonly WorkflowTarget[];
  readonly runs: readonly WorkflowRun[];
  readonly artifacts: readonly WorkflowArtifact[];
}
