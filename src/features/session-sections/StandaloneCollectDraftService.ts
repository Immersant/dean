import type {
  SessionSectionDraftResult,
  StandaloneCollectSessionSection,
} from '../../core/session-sections';
import type { FeatureHost } from '../FeatureHost';
import type { CollectSessionSectionController } from './CollectSessionSectionController';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';
import { formatStandaloneCollectDraft } from './StandaloneCollectDraft';

export interface OpenStandaloneCollectDraftOptions {
  readonly host: FeatureHost;
  readonly section: StandaloneCollectSessionSection;
  readonly notePath: string;
  readonly collect: CollectSessionSectionController;
}

export type StandaloneCollectDraftOpenResult =
  | SessionSectionDraftResult
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

  const result = await options.host.openSessionSectionDraft({
    content: formatStandaloneCollectDraft(snapshot, options.notePath),
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
