import type { SessionSectionAnswers } from '../../core/session-sections';
import type {
  CollectSessionSectionController,
  CollectSessionSectionFlushResult,
} from './CollectSessionSectionController';

export interface CollectSessionSectionLiveSnapshot {
  readonly notePath: string;
  readonly sectionId: string;
  readonly formId?: string;
  readonly answers: SessionSectionAnswers;
}

const READY_FLUSH: CollectSessionSectionFlushResult = { status: 'ready' };

const controllers = new Set<CollectSessionSectionController>();

export function registerCollectSessionSectionController(
  controller: CollectSessionSectionController,
): void {
  controllers.add(controller);
}

export function unregisterCollectSessionSectionController(
  controller: CollectSessionSectionController,
): void {
  controllers.delete(controller);
}

export function clearCollectSessionSectionRegistry(): void {
  controllers.clear();
}

export function snapshotCollectSessionSections(
  notePath: string,
): readonly CollectSessionSectionLiveSnapshot[] {
  return controllersForNote(notePath).map(controller => ({
    notePath: controller.getNotePath(),
    sectionId: controller.getSectionId(),
    formId: controller.getFormId(),
    answers: controller.getAnswers(),
  }));
}

export async function flushCollectSessionSections(
  notePath: string,
): Promise<CollectSessionSectionFlushResult> {
  let firstError: string | undefined;
  for (const controller of controllersForNote(notePath)) {
    const result = await controller.flush();
    if (result.status === 'blocked' && firstError === undefined) {
      firstError = result.error;
    }
  }
  if (firstError !== undefined) {
    return { status: 'blocked', error: firstError };
  }
  return READY_FLUSH;
}

function controllersForNote(notePath: string): CollectSessionSectionController[] {
  return [...controllers].filter(controller => controller.getNotePath() === notePath);
}
