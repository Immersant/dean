import { WORKFLOWS_PATH } from '../../core/bootstrap/storagePaths';
import type { VaultFileAdapter } from '../../core/storage/VaultFileAdapter';
import {
  assertValidWorkflowId,
  parseWorkflowRecord,
  type Workflow,
  type WorkflowScanResult,
  type WorkflowStore,
} from '../../core/workflows';

const WORKFLOW_FILE_SUFFIX = '.json';

export class WorkflowStorageService implements WorkflowStore {
  constructor(private readonly adapter: VaultFileAdapter) {}

  getPath(id: string): string {
    assertValidWorkflowId(id);
    return `${WORKFLOWS_PATH}/${id}${WORKFLOW_FILE_SUFFIX}`;
  }

  async load(id: string): Promise<Workflow | null> {
    assertValidWorkflowId(id);
    const path = this.getPath(id);
    if (!await this.adapter.exists(path)) return null;
    try {
      return parseWorkflowRecord(await this.adapter.read(path));
    } catch {
      return null;
    }
  }

  async save(workflow: Workflow): Promise<void> {
    await this.adapter.write(this.getPath(workflow.id), JSON.stringify(workflow, null, 2));
  }

  async scan(): Promise<WorkflowScanResult> {
    let paths: string[];
    try {
      paths = await this.adapter.listFiles(WORKFLOWS_PATH);
    } catch {
      return { records: [], invalidCount: 0, complete: false };
    }

    const records: Workflow[] = [];
    let invalidCount = 0;
    for (const path of paths) {
      const id = this.getIdFromPath(path);
      if (!id) continue;
      try {
        const workflow = parseWorkflowRecord(await this.adapter.read(path));
        if (workflow.id !== id) {
          invalidCount += 1;
          continue;
        }
        records.push(workflow);
      } catch {
        invalidCount += 1;
      }
    }

    return { records, invalidCount, complete: true };
  }

  private getIdFromPath(path: string): string | null {
    if (!path.startsWith(`${WORKFLOWS_PATH}/`) || !path.endsWith(WORKFLOW_FILE_SUFFIX)) {
      return null;
    }
    const id = path.slice(WORKFLOWS_PATH.length + 1, -WORKFLOW_FILE_SUFFIX.length);
    try {
      assertValidWorkflowId(id);
      return id;
    } catch {
      return null;
    }
  }
}
