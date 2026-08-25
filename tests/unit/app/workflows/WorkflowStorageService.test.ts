import { WorkflowStorageService } from '@/app/workflows/WorkflowStorageService';
import { WORKFLOWS_PATH } from '@/core/bootstrap/storagePaths';
import type { VaultFileAdapter } from '@/core/storage/VaultFileAdapter';
import type { Workflow } from '@/core/workflows';

function createAdapter(): jest.Mocked<VaultFileAdapter> {
  return {
    exists: jest.fn().mockResolvedValue(false),
    listFiles: jest.fn().mockResolvedValue([]),
    read: jest.fn(),
    write: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<VaultFileAdapter>;
}

function createWorkflow(): Workflow {
  return {
    schemaVersion: 1,
    id: 'workflow-001',
    title: 'Research project approaches',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    targets: [],
    runs: [],
    artifacts: [],
  };
}

describe('WorkflowStorageService', () => {
  it('round-trips a workflow through Dean-owned storage', async () => {
    const adapter = createAdapter();
    const storage = new WorkflowStorageService(adapter);
    const workflow = createWorkflow();

    await storage.save(workflow);

    expect(adapter.write).toHaveBeenCalledWith(
      `${WORKFLOWS_PATH}/workflow-001.json`,
      JSON.stringify(workflow, null, 2),
    );
    adapter.exists.mockResolvedValue(true);
    adapter.read.mockResolvedValue(JSON.stringify(workflow));

    await expect(storage.load(workflow.id)).resolves.toEqual(workflow);
  });

  it('reports malformed records during scans without overwriting them', async () => {
    const adapter = createAdapter();
    const storage = new WorkflowStorageService(adapter);
    adapter.listFiles.mockResolvedValue([
      `${WORKFLOWS_PATH}/workflow-001.json`,
      `${WORKFLOWS_PATH}/broken.json`,
    ]);
    adapter.read.mockImplementation(async (path) => (
      path.endsWith('workflow-001.json')
        ? JSON.stringify(createWorkflow())
        : '{not json'
    ));

    await expect(storage.scan()).resolves.toEqual({
      records: [createWorkflow()],
      invalidCount: 1,
      complete: true,
    });
    expect(adapter.write).not.toHaveBeenCalled();
  });
});
