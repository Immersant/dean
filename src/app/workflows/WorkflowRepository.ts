import type {
  Workflow,
  WorkflowInputSnapshot,
  WorkflowRun,
  WorkflowStore,
  WorkflowTarget,
} from '../../core/workflows';
import {
  transitionWorkflowRun,
  type WorkflowRunEvent,
  type WorkflowRunStatus,
} from '../../core/workflows';

export interface WorkflowRepositoryDependencies {
  readonly createId: () => string;
  readonly now: () => number;
}

export class WorkflowRepository {
  private readonly records = new Map<string, Workflow>();
  private readonly writeTails = new Map<string, Promise<void>>();

  constructor(
    private readonly store: WorkflowStore,
    private readonly deps: WorkflowRepositoryDependencies,
  ) {}

  async create(workflow: Workflow): Promise<Workflow> {
    const previous = this.writeTails.get(workflow.id) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(async () => {
      if (this.records.has(workflow.id)) {
        throw new Error(`Workflow "${workflow.id}" already exists.`);
      }
      await this.store.save(workflow);
      this.records.set(workflow.id, workflow);
      return workflow;
    });
    this.rememberWrite(workflow.id, pending);
    return pending;
  }

  get(id: string): Workflow | null {
    return this.records.get(id) ?? null;
  }

  async load(id: string): Promise<Workflow | null> {
    const workflow = await this.store.load(id);
    if (workflow) this.records.set(workflow.id, workflow);
    return workflow;
  }

  list(): readonly Workflow[] {
    return [...this.records.values()];
  }

  async createRetryRun(workflowId: string, failedRunId: string): Promise<WorkflowRun> {
    let retry: WorkflowRun | null = null;
    await this.withWorkflowWrite(workflowId, async (workflow) => {
      const failedRun = workflow.runs.find(run => run.id === failedRunId);
      if (!failedRun) {
        throw new Error(`Workflow run "${failedRunId}" was not found.`);
      }
      if (!canRetry(failedRun)) {
        throw new Error(`Workflow run "${failedRunId}" cannot be retried.`);
      }
      retry = {
        id: this.deps.createId(),
        workflowId,
        providerId: failedRun.providerId,
        status: 'queued',
        createdAt: this.deps.now(),
        input: copyInput(failedRun.input),
        events: [],
        artifactIds: [],
        parentRunId: failedRun.id,
      };
      return {
        ...workflow,
        updatedAt: retry.createdAt,
        runs: [...workflow.runs, retry],
      };
    });
    if (!retry) throw new Error('Workflow retry was not created.');
    return retry;
  }

  async transitionRun(
    workflowId: string,
    runId: string,
    status: WorkflowRunStatus,
    event: WorkflowRunEvent,
  ): Promise<WorkflowRun> {
    let transitioned: WorkflowRun | null = null;
    await this.withWorkflowWrite(workflowId, (workflow) => {
      const index = workflow.runs.findIndex(run => run.id === runId);
      if (index < 0) throw new Error(`Workflow run "${runId}" was not found.`);
      transitioned = transitionWorkflowRun(workflow.runs[index], status, event);
      const runs = [...workflow.runs];
      runs[index] = transitioned;
      return {
        ...workflow,
        updatedAt: event.at,
        runs,
      };
    });
    if (!transitioned) throw new Error('Workflow run transition was not applied.');
    return transitioned;
  }

  private async withWorkflowWrite(
    workflowId: string,
    operation: (current: Workflow) => Promise<Workflow> | Workflow,
  ): Promise<Workflow> {
    const previous = this.writeTails.get(workflowId) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(async () => {
      const current = this.records.get(workflowId);
      if (!current) throw new Error(`Workflow "${workflowId}" was not found.`);
      const next = await operation(current);
      await this.store.save(next);
      this.records.set(workflowId, next);
      return next;
    });
    this.rememberWrite(workflowId, pending);
    return pending;
  }

  private rememberWrite(workflowId: string, pending: Promise<unknown>): void {
    this.writeTails.set(workflowId, pending.then(() => undefined, () => undefined));
  }
}

function canRetry(run: WorkflowRun): boolean {
  return run.status === 'failed'
    || run.status === 'cancelled'
    || run.status === 'needs-attention';
}

function copyInput(input: WorkflowInputSnapshot): WorkflowInputSnapshot {
  return {
    prompt: input.prompt,
    targets: input.targets.map(copyTarget),
  };
}

function copyTarget(target: WorkflowTarget): WorkflowTarget {
  if (target.kind === 'note') return { ...target };
  return { ...target, nodeIds: [...target.nodeIds] };
}
