import { WorkflowRepository } from '@/app/workflows/WorkflowRepository';
import { WorkflowScheduler } from '@/app/workflows/WorkflowScheduler';
import {
  ProviderExecutionLifecycleRegistry,
  type ProviderExecutionBackend,
  type ProviderExecutionRequest,
  type ProviderExecutionSession,
  type ProviderInteractionPort,
} from '@/core/execution';
import type { Workflow, WorkflowStore } from '@/core/workflows';

function createWorkflow(status: Workflow['runs'][number]['status'] = 'queued'): Workflow {
  return {
    schemaVersion: 1,
    id: 'workflow-001',
    title: 'Research project approaches',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    targets: [],
    runs: [{
      id: 'run-001',
      workflowId: 'workflow-001',
      providerId: 'claude',
      status,
      createdAt: 1_700_000_000_000,
      input: { prompt: 'Research approaches.', targets: [] },
      events: [],
      artifactIds: [],
    }],
    artifacts: [],
  };
}

function createStore(): WorkflowStore {
  const records = new Map<string, Workflow>();
  return {
    load: async id => records.get(id) ?? null,
    save: async workflow => { records.set(workflow.id, workflow); },
    scan: async () => ({ records: [...records.values()], invalidCount: 0, complete: true }),
  };
}

function createBackend(dispose: jest.Mock): ProviderExecutionBackend {
  const session: ProviderExecutionSession = {
    providerId: 'claude',
    sessionInstanceId: 'session-001',
    execute: () => ({
      executionId: 'execution-001',
      turnId: 'turn-001',
      cancel: jest.fn(),
      events: (async function* () {
        yield {
          type: 'turn_started',
          accepted: true,
          scope: {
            kind: 'requested',
            sessionInstanceId: 'session-001',
            executionId: 'execution-001',
            turnId: 'turn-001',
            sequence: 1,
          },
        } as const;
        yield {
          type: 'turn_completed',
          reason: 'completed',
          scope: {
            kind: 'requested',
            sessionInstanceId: 'session-001',
            executionId: 'execution-001',
            turnId: 'turn-001',
            sequence: 2,
          },
        } as const;
      })(),
    }),
    cancel: jest.fn(),
    getSnapshot: () => ({ providerId: 'claude', revision: 0, status: 'idle' }),
    getStatus: () => 'idle',
    onEvent: () => () => undefined,
    dispose,
  };
  return {
    providerId: 'claude',
    createSession: jest.fn(() => session),
  };
}

describe('WorkflowScheduler', () => {
  it('persists a completed run and releases its isolated provider session', async () => {
    const repository = new WorkflowRepository(createStore(), {
      createId: () => 'unused',
      now: () => 1_700_000_000_001,
    });
    const workflow = createWorkflow();
    await repository.create(workflow);
    const dispose = jest.fn().mockResolvedValue(undefined);
    const scheduler = new WorkflowScheduler({
      repository,
      lifecycleRegistry: new ProviderExecutionLifecycleRegistry(),
      resolveBackend: () => createBackend(dispose),
      interactionPort: {} as ProviderInteractionPort,
      vaultWorkingDirectory: 'C:/vault',
      buildRequest: (_run, signal): ProviderExecutionRequest => ({
        input: [{ type: 'text', text: 'Research approaches.' }],
        configuration: { systemInstructions: { kind: 'provider-default' } },
        toolPolicy: { kind: 'provider-default' },
        signal,
      }),
    });

    await scheduler.enqueue(workflow.id, 'run-001');

    expect(repository.get(workflow.id)?.runs[0]).toEqual(expect.objectContaining({
      status: 'completed',
      events: [
        expect.objectContaining({ kind: 'started' }),
        expect.objectContaining({ kind: 'completed' }),
      ],
    }));
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('fails closed when restart recovery is unavailable for an interrupted run', async () => {
    const repository = new WorkflowRepository(createStore(), {
      createId: () => 'unused',
      now: () => 1_700_000_000_001,
    });
    const workflow = createWorkflow('running');
    await repository.create(workflow);
    const scheduler = new WorkflowScheduler({
      repository,
      lifecycleRegistry: new ProviderExecutionLifecycleRegistry(),
      resolveBackend: () => createBackend(jest.fn().mockResolvedValue(undefined)),
      interactionPort: {} as ProviderInteractionPort,
      vaultWorkingDirectory: 'C:/vault',
      buildRequest: (_run, signal): ProviderExecutionRequest => ({
        input: [{ type: 'text', text: 'Research approaches.' }],
        configuration: { systemInstructions: { kind: 'provider-default' } },
        toolPolicy: { kind: 'provider-default' },
        signal,
      }),
    });

    await scheduler.recover();

    expect(repository.get(workflow.id)?.runs[0]).toEqual(expect.objectContaining({
      status: 'needs-attention',
      events: [
        expect.objectContaining({ kind: 'recovery-unavailable' }),
      ],
    }));
  });
});
