import { createMockEl } from '@test/helpers/MockElement';

import { type BoundCollectSessionSection, validateSessionSection } from '@/core/session-sections';
import { CollectSessionSectionController } from '@/features/session-sections/CollectSessionSectionController';
import { clearSessionSectionDiagnostics } from '@/features/session-sections/SessionSectionDiagnostics';

jest.mock('@/features/session-sections/SessionSectionWriteBack', () => {
  const actual = jest.requireActual('@/features/session-sections/SessionSectionWriteBack');
  return {
    ...actual,
    writeSessionSectionToNote: jest.fn().mockResolvedValue({ status: 'written' }),
  };
});

import { writeSessionSectionToNote } from '@/features/session-sections/SessionSectionWriteBack';

const SECTION = validateSessionSection({
  schemaVersion: 1,
  id: 'sec_collect',
  conversationId: 'conv-1',
  epoch: 0,
  kind: 'collect',
  title: 'Feedback',
  status: 'open',
  createdAt: 1710000100000,
  questions: [
    {
      id: 'approach',
      prompt: 'Which model?',
      type: 'single',
      options: [
        { id: 'tabs', label: 'Tabs' },
        { id: 'sessions', label: 'Sessions' },
      ],
    },
    {
      id: 'notes',
      prompt: 'Comments',
      type: 'text',
    },
  ],
  answers: {
    approach: 'tabs',
    notes: '',
  },
  actions: [],
}) as BoundCollectSessionSection;

const BODY = 'schemaVersion: 1\nid: sec_collect\n';

describe('CollectSessionSectionController', () => {
  beforeEach(() => {
    clearSessionSectionDiagnostics();
    jest.clearAllMocks();
    jest.mocked(writeSessionSectionToNote).mockResolvedValue({ status: 'written' });
  });

  it('updates single and multi answers in memory without submitting chat', () => {
    const section = SECTION;
    const el = createMockEl() as unknown as HTMLElement;
    const controller = new CollectSessionSectionController({
      app: {} as any,
      el,
      ctx: { addChild: jest.fn() } as any,
      notePath: 'Notes/Spec.md',
      section,
      originalSource: BODY,
    });

    controller.setSingleAnswer('approach', 'sessions');
    controller.setAnswer('notes', 'looks good');
    controller.toggleMultiAnswer('tags', 'a', true);
    controller.toggleMultiAnswer('tags', 'b', true);
    controller.toggleMultiAnswer('tags', 'a', false);

    expect(controller.getAnswers()).toEqual({
      approach: 'sessions',
      notes: 'looks good',
      tags: ['b'],
    });
    expect(writeSessionSectionToNote).not.toHaveBeenCalled();
  });

  it('flush writes answers to the note and does not call submitSessionSectionTurn', async () => {
    const section = SECTION;
    const el = createMockEl() as unknown as HTMLElement;
    const controller = new CollectSessionSectionController({
      app: { vault: {} } as any,
      el,
      ctx: { addChild: jest.fn(), getSectionInfo: () => null } as any,
      notePath: 'Notes/Spec.md',
      section,
      originalSource: BODY,
    });

    controller.setSingleAnswer('approach', 'sessions');
    await controller.flush();

    expect(writeSessionSectionToNote).toHaveBeenCalledTimes(1);
    expect(writeSessionSectionToNote).toHaveBeenCalledWith(
      expect.objectContaining({
        notePath: 'Notes/Spec.md',
        section: expect.objectContaining({
          answers: expect.objectContaining({ approach: 'sessions' }),
        }),
      }),
    );
  });

  it('onunload flushes pending answers', async () => {
    const section = SECTION;
    const el = createMockEl() as unknown as HTMLElement;
    const controller = new CollectSessionSectionController({
      app: { vault: {} } as any,
      el,
      ctx: { addChild: jest.fn(), getSectionInfo: () => null } as any,
      notePath: 'Notes/Spec.md',
      section,
      originalSource: BODY,
    });

    controller.setAnswer('notes', 'final note');
    controller.onunload();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeSessionSectionToNote).toHaveBeenCalled();
    const call = jest.mocked(writeSessionSectionToNote).mock.calls[0][0];
    expect(call.section.answers.notes).toBe('final note');
  });

  it('skips redundant flush when answers are unchanged after a write', async () => {
    const section = SECTION;
    const el = createMockEl() as unknown as HTMLElement;
    const controller = new CollectSessionSectionController({
      app: { vault: {} } as any,
      el,
      ctx: { addChild: jest.fn(), getSectionInfo: () => null } as any,
      notePath: 'Notes/Spec.md',
      section,
      originalSource: BODY,
    });

    // Initial digest matches existing answers — first flush is a no-op.
    await controller.flush();
    expect(writeSessionSectionToNote).not.toHaveBeenCalled();

    controller.setAnswer('notes', 'changed');
    await controller.flush();
    await controller.flush();
    expect(writeSessionSectionToNote).toHaveBeenCalledTimes(1);
  });

  it('scheduleFlush debounces vault writes', async () => {
    jest.useFakeTimers();
    const section = SECTION;
    const el = createMockEl() as unknown as HTMLElement;
    const controller = new CollectSessionSectionController({
      app: { vault: {} } as any,
      el,
      ctx: { addChild: jest.fn(), getSectionInfo: () => null } as any,
      notePath: 'Notes/Spec.md',
      section,
      originalSource: BODY,
    });

    controller.setSingleAnswer('approach', 'sessions');
    controller.scheduleFlush(50);
    controller.scheduleFlush(50);
    expect(writeSessionSectionToNote).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    await Promise.resolve();
    await Promise.resolve();

    expect(writeSessionSectionToNote).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
