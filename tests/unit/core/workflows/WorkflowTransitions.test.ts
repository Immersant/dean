import type { WorkflowRun } from '@/core/workflows/Workflow';
import {
  WorkflowTransitionError,
  transitionWorkflowRun,
} from '@/core/workflows/WorkflowTransitions';

const QUEUED_RUN: WorkflowRun = {
  id: 'run-001',
  workflowId: 'workflow-001',
  providerId: 'claude',
  status: 'queued',
  createdAt: 1_700_000_000_000,
  input: { prompt: 'Research approaches.', targets: [] },
  events: [],
  artifactIds: [],
};

describe('transitionWorkflowRun', () => {
  it('records a transition from queued to running without changing the previous run', () => {
    const transitioned = transitionWorkflowRun(QUEUED_RUN, 'running', {
      at: 1_700_000_000_001,
      kind: 'started',
      message: 'Provider execution accepted the run.',
    });

    expect(transitioned).toEqual({
      ...QUEUED_RUN,
      status: 'running',
      events: [{
        at: 1_700_000_000_001,
        kind: 'started',
        message: 'Provider execution accepted the run.',
      }],
    });
    expect(QUEUED_RUN).toEqual({ ...QUEUED_RUN, events: [] });
  });

  it('rejects restarting a completed run instead of rewriting its history', () => {
    const completedRun: WorkflowRun = {
      ...QUEUED_RUN,
      status: 'completed',
      events: [{
        at: 1_700_000_000_002,
        kind: 'completed',
        message: 'Research finished.',
      }],
    };

    expect(() => transitionWorkflowRun(completedRun, 'running', {
      at: 1_700_000_000_003,
      kind: 'started',
      message: 'Attempting a forbidden restart.',
    })).toThrow(WorkflowTransitionError);
  });
});
