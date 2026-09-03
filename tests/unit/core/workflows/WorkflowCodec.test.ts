import {
  parseWorkflowRecord,
  WorkflowCodecError,
} from '@/core/workflows/WorkflowCodec';

const VALID_WORKFLOW = {
  schemaVersion: 1,
  id: 'workflow-001',
  title: 'Research project approaches',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  targets: [{ kind: 'note', path: 'Projects/Dean.md', role: 'publication' }],
  runs: [{
    id: 'run-001',
    workflowId: 'workflow-001',
    providerId: 'claude',
    status: 'queued',
    createdAt: 1_700_000_000_000,
    input: { prompt: 'Research approaches.', targets: [] },
    events: [],
    artifactIds: [],
  }],
  artifacts: [],
};

describe('parseWorkflowRecord', () => {
  it('decodes a valid durable workflow record', () => {
    expect(parseWorkflowRecord(JSON.stringify(VALID_WORKFLOW))).toEqual(VALID_WORKFLOW);
  });

  it('rejects a persisted run with an unknown lifecycle status', () => {
    const malformed = structuredClone(VALID_WORKFLOW);
    malformed.runs[0].status = 'backgrounding';

    expect(() => parseWorkflowRecord(JSON.stringify(malformed)))
      .toThrow(WorkflowCodecError);
  });
});
