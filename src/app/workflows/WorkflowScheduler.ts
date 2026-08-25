import type {
  ProviderExecutionBackend,
  ProviderExecutionRun,
  ProviderExecutionRequest,
  ProviderInteractionPort,
} from '../../core/execution';
import { ProviderExecutionLifecycleRegistry } from '../../core/execution';
import type { WorkflowRun } from '../../core/workflows';
import { WorkflowRepository } from './WorkflowRepository';

export interface WorkflowSchedulerDependencies {
  readonly repository: WorkflowRepository;
  readonly lifecycleRegistry: ProviderExecutionLifecycleRegistry;
  readonly resolveBackend: (providerId: WorkflowRun['providerId']) => ProviderExecutionBackend;
  readonly interactionPort: ProviderInteractionPort;
  readonly vaultWorkingDirectory: string;
  readonly buildRequest: (run: WorkflowRun, signal: AbortSignal) => ProviderExecutionRequest;
}

interface ActiveWorkflowExecution {
  readonly controller: AbortController;
  readonly cancel: () => void;
}

export class WorkflowScheduler {
  private readonly active = new Map<string, ActiveWorkflowExecution>();

  constructor(private readonly deps: WorkflowSchedulerDependencies) {}

  async enqueue(workflowId: string, runId: string): Promise<void> {
    const workflow = this.deps.repository.get(workflowId);
    const initialRun = workflow?.runs.find(run => run.id === runId);
    if (!initialRun) throw new Error(`Workflow run "${runId}" was not found.`);
    if (initialRun.status !== 'queued') {
      throw new Error(`Workflow run "${runId}" is not queued.`);
    }

    const key = this.getKey(workflowId, runId);
    if (this.active.has(key)) throw new Error(`Workflow run "${runId}" is already active.`);

    const controller = new AbortController();
    let lease: ReturnType<ProviderExecutionLifecycleRegistry['acquire']> | null = null;
    let providerRun: ProviderExecutionRun | null = null;
    this.active.set(key, {
      controller,
      cancel: () => {
        controller.abort();
        providerRun?.cancel();
      },
    });

    try {
      const running = await this.deps.repository.transitionRun(workflowId, runId, 'running', {
        at: Date.now(),
        kind: 'started',
        message: 'Provider execution accepted the workflow run.',
      });
      const backend = this.deps.resolveBackend(initialRun.providerId);
      lease = this.deps.lifecycleRegistry.acquire(backend, {
        lifecycle: 'ephemeral',
        nativePersistence: 'enabled',
        vaultWorkingDirectory: this.deps.vaultWorkingDirectory,
        interactionPort: this.deps.interactionPort,
      }, 'workflow');
      providerRun = lease.session.execute(this.deps.buildRequest(running, controller.signal));
      for await (const event of providerRun.events) {
        if (event.type === 'turn_completed') {
          await this.deps.repository.transitionRun(workflowId, runId, 'completed', {
            at: Date.now(),
            kind: 'completed',
            message: 'Provider execution completed the workflow run.',
          });
          return;
        }
        if (event.type === 'cancelled') {
          await this.deps.repository.transitionRun(workflowId, runId, 'cancelled', {
            at: Date.now(),
            kind: 'cancelled',
            message: event.reason || 'Workflow run was cancelled.',
          });
          return;
        }
        if (event.type === 'execution_error') {
          await this.deps.repository.transitionRun(workflowId, runId, 'failed', {
            at: Date.now(),
            kind: 'failed',
            message: event.message,
          });
          return;
        }
      }
      await this.deps.repository.transitionRun(workflowId, runId, 'failed', {
        at: Date.now(),
        kind: 'failed',
        message: 'Provider execution ended without a terminal event.',
      });
    } catch (error) {
      const latest = this.deps.repository.get(workflowId)?.runs.find(run => run.id === runId);
      if (latest?.status === 'running') {
        await this.deps.repository.transitionRun(workflowId, runId, 'failed', {
          at: Date.now(),
          kind: 'failed',
          message: error instanceof Error ? error.message : 'Workflow execution failed.',
        });
      }
      throw error;
    } finally {
      this.active.delete(key);
      await lease?.release();
    }
  }

  cancel(workflowId: string, runId: string): boolean {
    const active = this.active.get(this.getKey(workflowId, runId));
    if (!active) return false;
    active.cancel();
    return true;
  }

  private getKey(workflowId: string, runId: string): string {
    return `${workflowId}:${runId}`;
  }
}
