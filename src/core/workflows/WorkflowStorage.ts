import type { Workflow } from './Workflow';

export interface WorkflowScanResult {
  readonly records: readonly Workflow[];
  readonly invalidCount: number;
  readonly complete: boolean;
}

export interface WorkflowStore {
  load(id: string): Promise<Workflow | null>;
  save(workflow: Workflow): Promise<void>;
  scan(): Promise<WorkflowScanResult>;
}

export function isValidWorkflowId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)
    && id !== '.'
    && id !== '..';
}

export function assertValidWorkflowId(id: string): void {
  if (!isValidWorkflowId(id)) {
    throw new Error(`Invalid workflow id: ${JSON.stringify(id)}`);
  }
}
