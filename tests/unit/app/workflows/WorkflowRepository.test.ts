import { WorkflowRepository } from '@/app/workflows/WorkflowRepository';
import type { Workflow, WorkflowStore } from '@/core/workflows';

function createWorkflow(): Workflow {
  return {
    schemaVersion: 1,
    id: 'workflow-001',
    title: 'Research project approaches',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_001,
    targets: [],
    runs: [{
      id: 'run-001',
      workflowId: 'workflow-001',
      providerId: 'claude',
      status: 'failed',
      createdAt: 1_700_000_000_000,
      input: { prompt: 'Research approaches.', targets: [] },
      events: [{
        at: 1_700_000_000_001,
        kind: 'failed',
        message: 'Provider disconnected.',
      }],
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

describe('WorkflowRepository', () => {
  it('persists a newly created workflow once', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const store: WorkflowStore = {
      load: async () => null,
      save,
      scan: async () => ({ records: [], invalidCount: 0, complete: true }),
    };
    const repository = new WorkflowRepository(store, {
      createId: () => 'unused',
      now: () => 1,
    });

    await repository.create(createWorkflow());
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('creates a linked queued retry while preserving the failed run', async () => {
    const repository = new WorkflowRepository(createStore(), {
      createId: () => 'run-002',
      now: () => 1_700_000_000_002,
    });
    const workflow = createWorkflow();
    await repository.create(workflow);

    const retry = await repository.createRetryRun(workflow.id, 'run-001');

    expect(retry).toEqual({
      id: 'run-002',
      workflowId: 'workflow-001',
      providerId: 'claude',
      status: 'queued',
      createdAt: 1_700_000_000_002,
      input: { prompt: 'Research approaches.', targets: [] },
      events: [],
      artifactIds: [],
      parentRunId: 'run-001',
    });
    expect(repository.get(workflow.id)).toEqual({
      ...workflow,
      updatedAt: 1_700_000_000_002,
      runs: [workflow.runs[0], retry],
    });
  });
});
