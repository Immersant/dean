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
  startNewChat: 'Start new chat',
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

  it('merges sibling formId answers into one standalone draft', async () => {
    const getAnswers = jest.fn().mockReturnValue({ notes: 'From the clicked fence' });
    const flush = jest.fn().mockResolvedValue({ status: 'ready' });
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });
    const note = [
      '```dean-session',
      [
        'schemaVersion: 1',
        'id: sec_goal',
        'formId: form_intake',
        'kind: collect',
        'title: Intake',
        'status: open',
        'createdAt: 1710000100000',
        'startNewChat: Start new chat',
        'questions:',
        '  - id: goal',
        '    prompt: What should we build?',
        '    type: markdown',
        'answers:',
        '  goal: A parade of tiny robots',
      ].join('\n'),
      '```',
      '',
      'User markup.',
      '',
      '```dean-session',
      [
        'schemaVersion: 1',
        'id: standalone_discovery',
        'formId: form_intake',
        'kind: collect',
        'title: Notes',
        'status: open',
        'createdAt: 1710000100000',
        'startNewChat: Start new chat',
        'questions:',
        '  - id: notes',
        '    prompt: Anything else?',
        '    type: text',
        'answers:',
        '  notes: From the clicked fence',
      ].join('\n'),
      '```',
    ].join('\n');

    await expect(openStandaloneCollectDraft({
      host: {
        openSessionSectionDraft,
        app: {
          vault: {
            getAbstractFileByPath: () => ({ path: 'Notes/Discovery.md' }),
            read: jest.fn().mockResolvedValue(note),
          },
        },
      } as unknown as FeatureHost,
      section: { ...STANDALONE_SECTION, formId: 'form_intake' },
      notePath: 'Notes/Discovery.md',
      collect: { getAnswers, flush } as unknown as CollectSessionSectionController,
    })).resolves.toEqual({ status: 'opened' });

    expect(openSessionSectionDraft).toHaveBeenCalledTimes(1);
    const content = openSessionSectionDraft.mock.calls[0][0].content as string;
    expect(content).toContain('# Intake');
    expect(content).toContain('A parade of tiny robots');
    expect(content).toContain('From the clicked fence');
  });

  it('does not open a draft when the form group is invalid', async () => {
    const openSessionSectionDraft = jest.fn();
    const mixed = [
      '```dean-session',
      [
        'schemaVersion: 1',
        'id: sec_bound',
        'formId: form_intake',
        'conversationId: conv-1',
        'epoch: 0',
        'kind: collect',
        'title: Bound',
        'status: open',
        'createdAt: 1710000100000',
        'questions:',
        '  - id: goal',
        '    prompt: Goal?',
        '    type: text',
        'answers:',
        '  goal: mixed',
      ].join('\n'),
      '```',
      '',
      '```dean-session',
      [
        'schemaVersion: 1',
        'id: standalone_discovery',
        'formId: form_intake',
        'kind: collect',
        'title: Notes',
        'status: open',
        'createdAt: 1710000100000',
        'startNewChat: Start new chat',
        'questions:',
        '  - id: notes',
        '    prompt: Notes?',
        '    type: text',
        'answers: {}',
      ].join('\n'),
      '```',
    ].join('\n');

    const result = await openStandaloneCollectDraft({
      host: {
        openSessionSectionDraft,
        app: {
          vault: {
            getAbstractFileByPath: () => ({ path: 'Notes/Discovery.md' }),
            read: jest.fn().mockResolvedValue(mixed),
          },
        },
      } as unknown as FeatureHost,
      section: { ...STANDALONE_SECTION, formId: 'form_intake' },
      notePath: 'Notes/Discovery.md',
      collect: {
        getAnswers: () => ({}),
        flush: jest.fn().mockResolvedValue({ status: 'ready' }),
      } as unknown as CollectSessionSectionController,
    });

    expect(result).toEqual({ status: 'blocked', reason: 'invalid-request' });
    expect(openSessionSectionDraft).not.toHaveBeenCalled();
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
