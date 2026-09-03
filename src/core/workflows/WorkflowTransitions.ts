import type { WorkflowRun, WorkflowRunEvent, WorkflowRunStatus } from './Workflow';

const ALLOWED_TRANSITIONS: Readonly<Record<WorkflowRunStatus, readonly WorkflowRunStatus[]>> = {
  queued: ['running', 'cancelled', 'needs-attention'],
  running: ['waiting', 'recovering', 'completed', 'failed', 'cancelled', 'needs-attention'],
  waiting: ['queued', 'cancelled', 'needs-attention'],
  recovering: ['queued', 'running', 'needs-attention', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
  'needs-attention': ['queued', 'cancelled'],
};

export class WorkflowTransitionError extends Error {
  constructor(from: WorkflowRunStatus, to: WorkflowRunStatus) {
    super(`Workflow run cannot transition from "${from}" to "${to}".`);
    this.name = 'WorkflowTransitionError';
  }
}

export function transitionWorkflowRun(
  run: WorkflowRun,
  status: WorkflowRunStatus,
  event: WorkflowRunEvent,
): WorkflowRun {
  if (!ALLOWED_TRANSITIONS[run.status].includes(status)) {
    throw new WorkflowTransitionError(run.status, status);
  }
  return {
    ...run,
    status,
    events: [...run.events, event],
  };
}
