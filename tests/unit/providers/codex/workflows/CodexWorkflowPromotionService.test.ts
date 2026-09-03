import {
  parseCodexWorkflowPromotionResponse,
} from '@/providers/codex/workflows/CodexWorkflowPromotionService';

describe('parseCodexWorkflowPromotionResponse', () => {
  const noteCandidate = {
    kind: 'note' as const,
    path: 'Project.md',
    role: 'publication' as const,
  };
  const canvasCandidate = {
    kind: 'canvas' as const,
    path: 'Project.canvas',
    role: 'input' as const,
    nodeIds: ['node-1', 'node-2'],
  };

  it('accepts ordinary-chat and clarification decisions', () => {
    expect(parseCodexWorkflowPromotionResponse(
      JSON.stringify({ kind: 'ordinary-chat' }),
      [noteCandidate],
    )).toEqual({ kind: 'ordinary-chat' });
    expect(parseCodexWorkflowPromotionResponse(JSON.stringify({
      kind: 'clarification-required',
      question: 'Which note should receive the result?',
    }), [noteCandidate])).toEqual({
      kind: 'clarification-required',
      question: 'Which note should receive the result?',
    });
  });

  it('accepts a background nomination only when every target is a supplied candidate', () => {
    expect(parseCodexWorkflowPromotionResponse(JSON.stringify({
      kind: 'background-workflow',
      title: 'Research project options',
      targets: [noteCandidate, canvasCandidate],
    }), [noteCandidate, canvasCandidate])).toEqual({
      kind: 'background-workflow',
      title: 'Research project options',
      targets: [noteCandidate, canvasCandidate],
    });
  });

  it('fails closed for malformed decisions and invented targets', () => {
    expect(parseCodexWorkflowPromotionResponse('not JSON', [noteCandidate]))
      .toEqual({ kind: 'ordinary-chat' });
    expect(parseCodexWorkflowPromotionResponse(JSON.stringify({
      kind: 'clarification-required',
      question: '',
    }), [noteCandidate])).toEqual({ kind: 'ordinary-chat' });
    expect(parseCodexWorkflowPromotionResponse(JSON.stringify({
      kind: 'background-workflow',
      title: 'Rewrite another note',
      targets: [{ kind: 'note', path: 'Elsewhere.md', role: 'publication' }],
    }), [noteCandidate])).toEqual({ kind: 'ordinary-chat' });
  });

  it('requires an exact ordered Canvas node selection', () => {
    expect(parseCodexWorkflowPromotionResponse(JSON.stringify({
      kind: 'background-workflow',
      title: 'Summarize the canvas',
      targets: [{ ...canvasCandidate, nodeIds: ['node-2', 'node-1'] }],
    }), [canvasCandidate])).toEqual({ kind: 'ordinary-chat' });
  });
});
