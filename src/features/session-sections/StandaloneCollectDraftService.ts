import type {
  SessionSectionDraftResult,
  StandaloneCollectSessionSection,
} from '../../core/session-sections';
import type { FeatureHost } from '../FeatureHost';
import type { CollectSessionSectionController } from './CollectSessionSectionController';
import { resolveNoteSessionSectionForm } from './resolveNoteSessionSectionForm';
import { confirmSessionSectionAction } from './SessionSectionConfirmModal';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';
import {
  formatStandaloneCollectDraft,
  type StandaloneCollectDraftView,
} from './StandaloneCollectDraft';

export interface OpenStandaloneCollectDraftOptions {
  readonly host: FeatureHost;
  readonly section: StandaloneCollectSessionSection;
  readonly notePath: string;
  readonly collect: CollectSessionSectionController;
}

export type StandaloneCollectDraftOpenResult =
  | SessionSectionDraftResult
  | { readonly status: 'cancelled' }
  | { readonly status: 'blocked'; readonly reason: 'writeback-failed' };

export async function openStandaloneCollectDraft(
  options: OpenStandaloneCollectDraftOptions,
): Promise<StandaloneCollectDraftOpenResult> {
  const answers = options.collect.getAnswers();
  const snapshot: StandaloneCollectSessionSection = {
    ...options.section,
    answers,
  };
  const flush = await options.collect.flush();
  if (flush.status === 'blocked') {
    recordSessionSectionDiagnostic({
      level: 'error',
      code: 'new-chat-writeback-failed',
      message: flush.error,
      sectionId: options.section.id,
    });
    return { status: 'blocked', reason: 'writeback-failed' };
  }

  let draftView: StandaloneCollectDraftView = snapshot;
  if (options.section.formId) {
    const form = await resolveNoteSessionSectionForm(
      options.host,
      options.notePath,
      options.section.formId,
    );
    if (!form.ok) {
      recordSessionSectionDiagnostic({
        level: 'error',
        code: `form-${form.code}`,
        message: form.message,
        sectionId: options.section.id,
      });
      return { status: 'blocked', reason: 'invalid-request' };
    }
    draftView = {
      title: form.title,
      questions: form.questions,
      answers: form.answers,
    };
  }

  const content = formatStandaloneCollectDraft(draftView, options.notePath);
  const confirmed = await confirmSessionSectionAction(options.host.app, {
    notePath: options.notePath,
    actionLabel: options.section.startNewChat,
    draft: content,
    allowSend: false,
    stale: options.section.status === 'stale',
  });
  if (confirmed === 'cancelled') {
    recordSessionSectionDiagnostic({
      level: 'info',
      code: 'cancelled',
      message: 'User cancelled Collect new-chat confirmation',
      sectionId: options.section.id,
    });
    return { status: 'cancelled' };
  }

  const result = await options.host.openSessionSectionDraft({
    content,
    sourceNotePath: options.notePath,
  });
  recordSessionSectionDiagnostic({
    level: result.status === 'opened' ? 'info' : 'warn',
    code: result.status === 'opened' ? 'new-chat-draft-opened' : 'new-chat-draft-blocked',
    message: result.status === 'opened' ? 'Opened standalone Collect draft' : result.reason,
    sectionId: options.section.id,
  });
  return result;
}
