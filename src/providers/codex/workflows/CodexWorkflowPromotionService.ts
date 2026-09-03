import type { AuxiliaryExecutionContext } from '../../../core/auxiliary/AuxiliaryExecutionContext';
import { AuxiliarySessionController } from '../../../core/auxiliary/AuxiliarySessionController';
import {
  isWorkflowPromotionDecision,
  type ProviderWorkflowPromotionService,
  type WorkflowPromotionDecision,
  type WorkflowPromotionRequest,
  type WorkflowTarget,
} from '../../../core/workflows';

const PROMOTION_SYSTEM_PROMPT = `You decide whether a chat request should become a durable background workflow.

Return only JSON with exactly one of these shapes:
{"kind":"ordinary-chat"}
{"kind":"clarification-required","question":"..."}
{"kind":"background-workflow","title":"...","targets":[...]}

Nominate a background workflow only when the request has a clear durable outcome, one or more supplied safe targets, and a reason to continue asynchronously. Select targets only from targetCandidates. A userRequestedBackground value is a preference to evaluate carefully, not an instruction to promote. Do not infer missing targets.`;

export class CodexWorkflowPromotionService implements ProviderWorkflowPromotionService {
  constructor(private readonly context: AuxiliaryExecutionContext) {}

  async decide(request: WorkflowPromotionRequest): Promise<WorkflowPromotionDecision> {
    const controller = new AuxiliarySessionController(
      this.context,
      'workflow-promotion',
      { kind: 'passive' },
    );
    try {
      await controller.startRoot();
      const response = await controller.execute({
        prompt: JSON.stringify(request),
        systemPrompt: PROMOTION_SYSTEM_PROMPT,
      });
      return parseCodexWorkflowPromotionResponse(response, request.targetCandidates);
    } catch {
      return { kind: 'ordinary-chat' };
    } finally {
      await controller.dispose().catch(() => undefined);
    }
  }
}

export function parseCodexWorkflowPromotionResponse(
  response: string,
  targetCandidates: readonly WorkflowTarget[],
): WorkflowPromotionDecision {
  let value: unknown;
  try {
    value = JSON.parse(response);
  } catch {
    return { kind: 'ordinary-chat' };
  }
  if (!isWorkflowPromotionDecision(value)) return { kind: 'ordinary-chat' };
  if (value.kind !== 'background-workflow') return value;
  return value.targets.every(target => isCandidateTarget(target, targetCandidates))
    ? value
    : { kind: 'ordinary-chat' };
}

function isCandidateTarget(
  target: WorkflowTarget,
  candidates: readonly WorkflowTarget[],
): boolean {
  return candidates.some(candidate => {
    if (target.kind !== candidate.kind || target.path !== candidate.path || target.role !== candidate.role) {
      return false;
    }
    if (target.kind === 'note' && candidate.kind === 'note') {
      return target.sectionId === candidate.sectionId;
    }
    return target.kind === 'canvas'
      && candidate.kind === 'canvas'
      && target.nodeIds.length === candidate.nodeIds.length
      && target.nodeIds.every((nodeId, index) => nodeId === candidate.nodeIds[index]);
  });
}
