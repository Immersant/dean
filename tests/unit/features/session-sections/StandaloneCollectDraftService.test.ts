import type { StandaloneCollectSessionSection } from '@/core/session-sections';
import type { FeatureHost } from '@/features/FeatureHost';
import type { CollectSessionSectionController } from '@/features/session-sections/CollectSessionSectionController';
import { openStandaloneCollectDraft } from '@/features/session-sections/StandaloneCollectDraftService';

const STANDALONE_SECTION: StandaloneCollectSessionSection = {
  schemaVersion: 1,
  id: 'standalone_discovery',
  kind: 'collect',
  title: 'Discovery',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: true,
  actions: [],
  questions: [
    { id: 'goal', prompt: 'What should we build?', type: 'markdown' },
  ],
  answers: {},
};

describe('openStandaloneCollectDraft', () => {
  it('snapshots answers, flushes, then opens an unsent draft', async () => {
    const getAnswers = jest.fn().mockReturnValue({ goal: 'Use a fresh chat' });
    const flush = jest.fn().mockResolvedValue({ status: 'ready' });
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });

    await expect(openStandaloneCollectDraft({
      host: { openSessionSectionDraft } as unknown as FeatureHost,
      section: STANDALONE_SECTION,
      notePath: 'Notes/Discovery.md',
      collect: { getAnswers, flush } as unknown as CollectSessionSectionController,
    })).resolves.toEqual({ status: 'opened' });

    expect(getAnswers).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(openSessionSectionDraft).toHaveBeenCalledWith(expect.objectContaining({
      sourceNotePath: 'Notes/Discovery.md',
      content: expect.stringContaining('Use a fresh chat'),
    }));
    expect(getAnswers.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0]);
    expect(flush.mock.invocationCallOrder[0])
      .toBeLessThan(openSessionSectionDraft.mock.invocationCallOrder[0]);
  });

  it('does not open a chat when answer write-back is blocked', async () => {
    const openSessionSectionDraft = jest.fn();
    const result = await openStandaloneCollectDraft({
      host: { openSessionSectionDraft } as unknown as FeatureHost,
      section: STANDALONE_SECTION,
      notePath: 'Notes/Discovery.md',
      collect: {
        getAnswers: () => ({ goal: 'Unsaved' }),
        flush: jest.fn().mockResolvedValue({ status: 'blocked', error: 'disk full' }),
      } as unknown as CollectSessionSectionController,
    });
    expect(result).toEqual({ status: 'blocked', reason: 'writeback-failed' });
    expect(openSessionSectionDraft).not.toHaveBeenCalled();
  });
});
