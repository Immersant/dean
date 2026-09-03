import type { WorkflowTarget } from './Workflow';

export interface WorkflowPromotionRequest {
  readonly prompt: string;
  readonly targetCandidates: readonly WorkflowTarget[];
  readonly userRequestedBackground: boolean;
}

export type WorkflowPromotionDecision =
  | {
      readonly kind: 'ordinary-chat';
    }
  | {
      readonly kind: 'clarification-required';
      readonly question: string;
    }
  | {
      readonly kind: 'background-workflow';
      readonly title: string;
      readonly targets: readonly WorkflowTarget[];
    };

/**
 * A provider-owned service that returns structured workflow intent. The
 * coordinator must not infer this decision from regular assistant text.
 */
export interface ProviderWorkflowPromotionService {
  decide(request: WorkflowPromotionRequest): Promise<WorkflowPromotionDecision>;
}

export function isWorkflowPromotionDecision(
  value: unknown,
): value is WorkflowPromotionDecision {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;

  if (value.kind === 'ordinary-chat') return true;
  if (value.kind === 'clarification-required') {
    return typeof value.question === 'string' && value.question.trim().length > 0;
  }
  if (value.kind === 'background-workflow') {
    return typeof value.title === 'string'
      && value.title.trim().length > 0
      && Array.isArray(value.targets)
      && value.targets.length > 0
      && value.targets.every(isWorkflowTarget);
  }
  return false;
}

function isWorkflowTarget(value: unknown): value is WorkflowTarget {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (!isTargetRole(value.role) || !isVaultRelativePath(value.path)) return false;

  if (value.kind === 'note') {
    return value.sectionId === undefined || isLocalId(value.sectionId);
  }
  return value.kind === 'canvas'
    && Array.isArray(value.nodeIds)
    && value.nodeIds.length > 0
    && value.nodeIds.every(isLocalId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTargetRole(value: unknown): value is 'input' | 'publication' | 'both' {
  return value === 'input' || value === 'publication' || value === 'both';
}

function isVaultRelativePath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').includes('..');
}

function isLocalId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}
