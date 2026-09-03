import type {
  WorkflowPromotionDecision,
  WorkflowPromotionRequest,
} from '@/core/workflows/WorkflowPromotion';
import { isWorkflowPromotionDecision } from '@/core/workflows/WorkflowPromotion';

describe('workflow promotion contract', () => {
  it('keeps preference signals separate from a provider promotion decision', () => {
    const request: WorkflowPromotionRequest = {
      prompt: 'Research options and leave a brief in Project.md.',
      targetCandidates: [{ kind: 'note', path: 'Project.md', role: 'publication' }],
      userRequestedBackground: true,
    };
    const decision: WorkflowPromotionDecision = {
      kind: 'background-workflow',
      title: 'Research project options',
      targets: [{ kind: 'note', path: 'Project.md', role: 'publication' }],
    };

    expect(request.userRequestedBackground).toBe(true);
    expect(isWorkflowPromotionDecision(decision)).toBe(true);
    expect(isWorkflowPromotionDecision({ kind: 'background-workflow' })).toBe(false);
  });
});
