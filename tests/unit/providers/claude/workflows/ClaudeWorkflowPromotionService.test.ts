import {
  parseClaudeWorkflowPromotionResponse,
} from '@/providers/claude/workflows/ClaudeWorkflowPromotionService';

describe('parseClaudeWorkflowPromotionResponse', () => {
  const candidates = [{
    kind: 'note' as const,
    path: 'Project.md',
    role: 'publication' as const,
  }];

  it('accepts a provider nomination only when it selects a supplied safe target', () => {
    expect(parseClaudeWorkflowPromotionResponse(JSON.stringify({
      kind: 'background-workflow',
      title: 'Research project options',
      targets: candidates,
    }), candidates)).toEqual({
      kind: 'background-workflow',
      title: 'Research project options',
      targets: candidates,
    });
  });

  it('fails closed to ordinary chat for malformed or invented targets', () => {
    expect(parseClaudeWorkflowPromotionResponse('not JSON', candidates))
      .toEqual({ kind: 'ordinary-chat' });
    expect(parseClaudeWorkflowPromotionResponse(JSON.stringify({
      kind: 'background-workflow',
      title: 'Rewrite another note',
      targets: [{ kind: 'note', path: 'Elsewhere.md', role: 'publication' }],
    }), candidates)).toEqual({ kind: 'ordinary-chat' });
  });
});
