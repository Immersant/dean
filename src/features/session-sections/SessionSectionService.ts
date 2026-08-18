import {
  type BoundSessionSection,
  isBoundSessionSection,
  parseSessionSectionYaml,
  type SessionSection,
  type SessionSectionAction,
  type SessionSectionTurnRequest,
  type SessionSectionTurnResult,
} from '../../core/session-sections';
import { t } from '../../i18n/i18n';
import type { FeatureHost } from '../FeatureHost';
import { confirmSessionSectionAction } from './SessionSectionConfirmModal';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';

export interface ActivateSessionSectionActionOptions {
  readonly host: FeatureHost;
  readonly source: string;
  readonly notePath: string;
  readonly actionId: string;
}

/**
 * Re-parse the fence, confirm the Act prompt, then submit through FeatureHost.
 * Always re-parses so a stale widget cannot pair an old action with a new epoch.
 */
export async function activateSessionSectionAction(
  options: ActivateSessionSectionActionOptions,
): Promise<SessionSectionTurnResult | { status: 'cancelled' }> {
  const { host, source, notePath, actionId } = options;

  let section: SessionSection;
  try {
    section = parseSessionSectionYaml(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid section';
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'parse-failed',
      message,
      actionId,
    });
    return { status: 'blocked', reason: 'invalid-request' };
  }

  if (!isBoundSessionSection(section)) {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'standalone-action-blocked',
      message: 'Standalone Collect sections cannot activate actions',
      sectionId: section.id,
      actionId,
    });
    return { status: 'blocked', reason: 'invalid-request' };
  }

  const action = section.actions.find(item => item.id === actionId);
  if (!action) {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'action-missing',
      message: `Action "${actionId}" not found in fence`,
      conversationId: section.conversationId,
      sectionId: section.id,
      actionId,
    });
    return { status: 'blocked', reason: 'invalid-request' };
  }

  const conversation = host.getConversationSync(section.conversationId)
    ?? await host.getConversationById(section.conversationId);
  const conversationTitle = conversation?.title?.trim()
    || t('settings.sessionSections.confirm.unknownConversation');

  const confirmed = await confirmSessionSectionAction(host.app, {
    conversationTitle,
    conversationArchived: conversation?.isArchived === true,
    notePath,
    actionLabel: action.label,
    prompt: action.prompt,
    stale: section.status === 'stale',
  });
  if (!confirmed) {
    recordSessionSectionDiagnostic({
      level: 'info',
      code: 'cancelled',
      message: 'User cancelled Act confirm',
      conversationId: section.conversationId,
      sectionId: section.id,
      actionId,
    });
    return { status: 'cancelled' };
  }

  const request = buildSessionSectionTurnRequest(section, action, notePath);
  const result = await host.submitSessionSectionTurn(section.conversationId, request);
  recordSessionSectionDiagnostic({
    level: result.status === 'blocked' ? 'warn' : 'info',
    code: `submit-${result.status}`,
    message: result.status === 'blocked'
      ? `Blocked: ${result.reason}`
      : `Act ${result.status}`,
    conversationId: section.conversationId,
    sectionId: section.id,
    actionId,
  });
  return result;
}

export function buildSessionSectionTurnRequest(
  section: BoundSessionSection,
  action: SessionSectionAction,
  notePath: string,
): SessionSectionTurnRequest {
  return {
    displayContent: t('settings.sessionSections.displayLabel', { label: action.label }),
    canonicalText: action.prompt,
    hostNotePath: notePath,
    epoch: section.epoch,
    sessionSection: {
      sectionId: section.id,
      notePath,
      conversationId: section.conversationId,
      kind: section.kind,
      actionId: action.id,
      actionLabel: action.label,
      title: section.title,
      prompt: action.prompt,
      ...(Object.keys(section.answers).length > 0
        ? { answers: { ...section.answers } }
        : {}),
    },
  };
}
