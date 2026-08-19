import { createMockEl } from '@test/helpers/MockElement';

import { type BoundCollectSessionSection, validateSessionSection } from '@/core/session-sections';
import { CollectSessionSectionController } from '@/features/session-sections/CollectSessionSectionController';
import {
  clearCollectSessionSectionRegistry,
  flushCollectSessionSections,
  snapshotCollectSessionSections,
} from '@/features/session-sections/CollectSessionSectionRegistry';

jest.mock('@/features/session-sections/SessionSectionWriteBack', () => {
  const actual = jest.requireActual('@/features/session-sections/SessionSectionWriteBack');
  return {
    ...actual,
    writeSessionSectionToNote: jest.fn().mockResolvedValue({ status: 'written' }),
  };
});

import { writeSessionSectionToNote } from '@/features/session-sections/SessionSectionWriteBack';

function collectSection(
  id: string,
  formId?: string,
): BoundCollectSessionSection {
  return validateSessionSection({
    schemaVersion: 1,
    id,
    ...(formId ? { formId } : {}),
    conversationId: 'conv-1',
    epoch: 0,
    kind: 'collect',
    title: id,
    status: 'open',
    createdAt: 1710000100000,
    questions: [{ id: `${id}_q`, prompt: 'Q', type: 'text' }],
    answers: { [`${id}_q`]: '' },
    actions: [],
  }) as BoundCollectSessionSection;
}

function createController(
  section: BoundCollectSessionSection,
  notePath = 'Notes/Spec.md',
): CollectSessionSectionController {
  return new CollectSessionSectionController({
    app: { vault: {} } as never,
    el: createMockEl() as unknown as HTMLElement,
    ctx: { addChild: jest.fn(), getSectionInfo: () => null } as never,
    notePath,
    section,
    originalSource: `id: ${section.id}\n`,
  });
}

describe('CollectSessionSectionRegistry', () => {
  beforeEach(() => {
    clearCollectSessionSectionRegistry();
    jest.clearAllMocks();
    jest.mocked(writeSessionSectionToNote).mockResolvedValue({ status: 'written' });
  });

  afterEach(() => {
    clearCollectSessionSectionRegistry();
  });

  it('registers on construct and unregisters on unload', () => {
    const controller = createController(collectSection('sec_a', 'form_feedback'));
    controller.setAnswer('sec_a_q', 'live');
    expect(snapshotCollectSessionSections('Notes/Spec.md')).toEqual([
      expect.objectContaining({
        sectionId: 'sec_a',
        formId: 'form_feedback',
        answers: { sec_a_q: 'live' },
      }),
    ]);

    controller.onunload();
    expect(snapshotCollectSessionSections('Notes/Spec.md')).toEqual([]);
  });

  it('flushAll waits for every live controller on the note', async () => {
    const first = createController(collectSection('sec_a'));
    const second = createController(collectSection('sec_b'));
    createController(collectSection('sec_other'), 'Notes/Other.md');
    first.setAnswer('sec_a_q', 'one');
    second.setAnswer('sec_b_q', 'two');

    await expect(flushCollectSessionSections('Notes/Spec.md')).resolves.toEqual({
      status: 'ready',
    });
    const writtenIds = jest.mocked(writeSessionSectionToNote).mock.calls.map(
      call => call[0].section.id,
    );
    expect(writtenIds).toEqual(expect.arrayContaining(['sec_a', 'sec_b']));
    expect(writtenIds).not.toContain('sec_other');
  });

  it('flushAll is blocked when any sibling write-back fails', async () => {
    jest.mocked(writeSessionSectionToNote)
      .mockResolvedValueOnce({ status: 'written' })
      .mockResolvedValueOnce({ status: 'failed', error: 'disk full' });
    const first = createController(collectSection('sec_a'));
    const second = createController(collectSection('sec_b'));
    first.setAnswer('sec_a_q', 'one');
    second.setAnswer('sec_b_q', 'two');

    await expect(flushCollectSessionSections('Notes/Spec.md')).resolves.toEqual({
      status: 'blocked',
      error: 'disk full',
    });
    expect(writeSessionSectionToNote).toHaveBeenCalledTimes(2);
  });
});
