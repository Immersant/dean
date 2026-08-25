import {
  type BoundSessionSection,
  isBoundSessionSection,
  parseSessionSectionYaml,
  type SessionSection,
  type SessionSectionAction,
  type SessionSectionAnswers,
  type SessionSectionDraftResult,
  type SessionSectionQuestion,
  type SessionSectionTurnRequest,
  type SessionSectionTurnResult,
} from '../../core/session-sections';
import type { ExecutionInputSessionSectionQuestionSnapshot } from '../../core/types';
import { t } from '../../i18n/i18n';
import type { FeatureHost } from '../FeatureHost';
import { resolveNoteSessionSectionForm } from './resolveNoteSessionSectionForm';
import { confirmSessionSectionAction } from './SessionSectionConfirmModal';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';
import { formatSessionSectionActionDraft } from './StandaloneCollectDraft';

export interface ActivateSessionSectionActionOptions {
  readonly host: FeatureHost;
  readonly source: string;
  readonly notePath: string;
  readonly actionId: string;
}

/**
 * Re-parse the fence, then either open an opted-in new-chat draft or submit through FeatureHost.
 * Always re-parses so a stale widget cannot pair an old action with a new epoch.
 */
export async function activateSessionSectionAction(
  options: ActivateSessionSectionActionOptions,
): Promise<SessionSectionTurnResult | SessionSectionDraftResult | { status: 'cancelled' }> {
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

  const form = section.formId
    ? await resolveNoteSessionSectionForm(host, notePath, section.formId)
    : null;
  if (form && form.ok === false) {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: `form-${form.code}`,
      message: form.message,
      conversationId: section.conversationId,
      sectionId: section.id,
      actionId,
    });
    return { status: 'blocked', reason: 'invalid-request' };
  }

  if (action.startNewChat) {
    const questions = form && form.ok ? form.questions : section.questions;
    const answers = form && form.ok ? form.answers : section.answers;
    const result = await host.openSessionSectionDraft({
      content: formatSessionSectionActionDraft({
        title: action.label,
        prompt: action.prompt,
        questions,
        answers,
      }, notePath),
      sourceNotePath: notePath,
    });
    recordSessionSectionDiagnostic({
      level: result.status === 'opened' ? 'info' : 'warn',
      code: result.status === 'opened' ? 'new-chat-draft-opened' : 'new-chat-draft-blocked',
      message: result.status === 'opened' ? 'Opened Act new-chat draft' : result.reason,
      conversationId: section.conversationId,
      sectionId: section.id,
      actionId,
    });
    return result;
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

  const request = buildSessionSectionTurnRequest(
    section,
    action,
    notePath,
    form && form.ok
      ? {
          answers: form.answers,
          questions: form.questions,
          formId: form.formId,
          memberSectionIds: form.memberSectionIds,
        }
      : undefined,
  );
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

export interface SessionSectionFormTurnOverlay {
  readonly answers: SessionSectionAnswers;
  readonly questions: readonly SessionSectionQuestion[];
  readonly formId: string;
  readonly memberSectionIds: readonly string[];
}

export function buildSessionSectionTurnRequest(
  section: BoundSessionSection,
  action: SessionSectionAction,
  notePath: string,
  form?: SessionSectionFormTurnOverlay,
): SessionSectionTurnRequest {
  const answers = form?.answers ?? section.answers;
  const questions = form?.questions ?? section.questions;
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
      ...(questions.length > 0 ? { questions: snapshotQuestions(questions) } : {}),
      ...(Object.keys(answers).length > 0 ? { answers: cloneAnswers(answers) } : {}),
      ...(form
        ? { formId: form.formId, memberSectionIds: [...form.memberSectionIds] }
        : {}),
    },
  };
}

function snapshotQuestions(
  questions: readonly SessionSectionQuestion[],
): ExecutionInputSessionSectionQuestionSnapshot[] {
  return questions.map(question => ({
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    ...(question.options
      ? { options: question.options.map(option => ({ id: option.id, label: option.label })) }
      : {}),
  }));
}

function cloneAnswers(answers: SessionSectionAnswers): SessionSectionAnswers {
  const cloned: SessionSectionAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    cloned[key] = Array.isArray(value) ? [...value] : value;
  }
  return cloned;
}


