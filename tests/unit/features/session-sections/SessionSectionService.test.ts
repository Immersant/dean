import { isBoundSessionSection, parseSessionSectionYaml } from '@/core/session-sections';
import type { FeatureHost } from '@/features/FeatureHost';
import { clearSessionSectionDiagnostics } from '@/features/session-sections/SessionSectionDiagnostics';
import {
  activateSessionSectionAction,
  buildSessionSectionTurnRequest,
} from '@/features/session-sections/SessionSectionService';

jest.mock('@/features/session-sections/SessionSectionConfirmModal', () => ({
  confirmSessionSectionAction: jest.fn(),
}));

import { confirmSessionSectionAction } from '@/features/session-sections/SessionSectionConfirmModal';

const VALID_ACT = `
schemaVersion: 1
id: sec_review
conversationId: conv-1
epoch: 2
kind: act
title: Follow-ups
status: open
createdAt: 1710000100000
actions:
  - id: review
    label: Review
    prompt: Review this note carefully.
`.trim();

describe('SessionSectionService', () => {
  beforeEach(() => {
    clearSessionSectionDiagnostics();
    jest.clearAllMocks();
  });

  it('buildSessionSectionTurnRequest uses prompt as canonical and short display label', () => {
    const section = parseSessionSectionYaml(VALID_ACT);
    if (!isBoundSessionSection(section)) {
      throw new Error('expected bound section fixture');
    }
    const action = section.actions[0];
    const request = buildSessionSectionTurnRequest(section, action, 'Notes/Spec.md');

    expect(request.canonicalText).toBe('Review this note carefully.');
    expect(request.displayContent).toContain('Review');
    expect(request.epoch).toBe(2);
    expect(request.hostNotePath).toBe('Notes/Spec.md');
    expect(request.sessionSection).toMatchObject({
      sectionId: 'sec_review',
      actionId: 'review',
      actionLabel: 'Review',
      conversationId: 'conv-1',
      notePath: 'Notes/Spec.md',
    });
  });

  it('activateSessionSectionAction cancels without submit when user declines', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue(false);
    const submit = jest.fn();
    const host = {
      app: {},
      getConversationSync: jest.fn().mockReturnValue({ id: 'conv-1', title: 'Test' }),
      getConversationById: jest.fn(),
      submitSessionSectionTurn: submit,
    } as unknown as FeatureHost;

    const result = await activateSessionSectionAction({
      host,
      source: VALID_ACT,
      notePath: 'Notes/Spec.md',
      actionId: 'review',
    });

    expect(result).toEqual({ status: 'cancelled' });
    expect(submit).not.toHaveBeenCalled();
  });

  it('activateSessionSectionAction submits after confirm', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue(true);
    const submit = jest.fn().mockResolvedValue({ status: 'sent' });
    const host = {
      app: {},
      getConversationSync: jest.fn().mockReturnValue({
        id: 'conv-1',
        title: 'Design session',
        isArchived: false,
      }),
      getConversationById: jest.fn(),
      submitSessionSectionTurn: submit,
    } as unknown as FeatureHost;

    const result = await activateSessionSectionAction({
      host,
      source: VALID_ACT,
      notePath: 'Notes/Spec.md',
      actionId: 'review',
    });

    expect(result).toEqual({ status: 'sent' });
    expect(submit).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        epoch: 2,
        hostNotePath: 'Notes/Spec.md',
        canonicalText: 'Review this note carefully.',
      }),
    );
    expect(confirmSessionSectionAction).toHaveBeenCalledWith(
      host.app,
      expect.objectContaining({
        conversationTitle: 'Design session',
        notePath: 'Notes/Spec.md',
        actionLabel: 'Review',
        prompt: 'Review this note carefully.',
      }),
    );
  });

  const FORM_NAV = `
schemaVersion: 1
id: sec_nav
formId: form_feedback
conversationId: conv-1
epoch: 2
kind: collect
title: Navigation
status: open
createdAt: 1710000100000
questions:
  - id: approach
    prompt: Which nav?
    type: text
answers:
  approach: tabs
`.trim();

  const FORM_DONE = `
schemaVersion: 1
id: sec_done
formId: form_feedback
conversationId: conv-1
epoch: 2
kind: collect
title: Notes
status: open
createdAt: 1710000100000
questions:
  - id: notes
    prompt: Comments
    type: markdown
answers:
  notes: Keep it small.
actions:
  - id: done
    label: I'm done
    prompt: Continue from the merged answers.
`.trim();

  function formNote(): string {
    return [
      '```dean-session',
      FORM_NAV,
      '```',
      '',
      'User markup.',
      '',
      '```dean-session',
      FORM_DONE,
      '```',
    ].join('\n');
  }

  function hostWithVault(submit: jest.Mock, note = formNote()) {
    const file = { path: 'Notes/Spec.md', extension: 'md' };
    return {
      app: {
        vault: {
          getAbstractFileByPath: () => file,
          read: jest.fn().mockResolvedValue(note),
        },
      },
      getConversationSync: jest.fn().mockReturnValue({
        id: 'conv-1',
        title: 'Design session',
        isArchived: false,
      }),
      getConversationById: jest.fn(),
      submitSessionSectionTurn: submit,
    } as unknown as FeatureHost;
  }

  it('merges sibling formId answers into the Act turn snapshot', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue(true);
    const submit = jest.fn().mockResolvedValue({ status: 'sent' });

    const result = await activateSessionSectionAction({
      host: hostWithVault(submit),
      source: FORM_DONE,
      notePath: 'Notes/Spec.md',
      actionId: 'done',
    });

    expect(result).toEqual({ status: 'sent' });
    expect(submit).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        sessionSection: expect.objectContaining({
          sectionId: 'sec_done',
          formId: 'form_feedback',
          memberSectionIds: ['sec_nav', 'sec_done'],
          answers: { approach: 'tabs', notes: 'Keep it small.' },
        }),
      }),
    );
  });

  it('does not confirm or submit when the form group is invalid', async () => {
    const submit = jest.fn();
    const standaloneSibling = `
schemaVersion: 1
id: sec_nav
formId: form_feedback
kind: collect
title: Navigation
status: open
createdAt: 1710000100000
startNewChat: Start new chat
questions:
  - id: approach
    prompt: Which nav?
    type: text
answers:
  approach: tabs
`.trim();
    const mixed = [
      '```dean-session',
      standaloneSibling,
      '```',
      '',
      '```dean-session',
      FORM_DONE,
      '```',
    ].join('\n');

    const result = await activateSessionSectionAction({
      host: hostWithVault(submit, mixed),
      source: FORM_DONE,
      notePath: 'Notes/Spec.md',
      actionId: 'done',
    });

    expect(result).toEqual({ status: 'blocked', reason: 'invalid-request' });
    expect(confirmSessionSectionAction).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps single-fence answers when formId is absent', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue(true);
    const submit = jest.fn().mockResolvedValue({ status: 'sent' });
    const collectWithAnswers = `
schemaVersion: 1
id: sec_review
conversationId: conv-1
epoch: 2
kind: collect
title: Feedback
status: open
createdAt: 1710000100000
questions:
  - id: notes
    prompt: Comments
    type: text
answers:
  notes: Only this fence
actions:
  - id: review
    label: Review
    prompt: Review this note carefully.
`.trim();

    const result = await activateSessionSectionAction({
      host: hostWithVault(submit),
      source: collectWithAnswers,
      notePath: 'Notes/Spec.md',
      actionId: 'review',
    });

    expect(result).toEqual({ status: 'sent' });
    expect(submit).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        sessionSection: expect.objectContaining({
          answers: { notes: 'Only this fence' },
        }),
      }),
    );
    expect(submit.mock.calls[0][1].sessionSection.formId).toBeUndefined();
  });

  it('activateSessionSectionAction does not submit missing actions', async () => {
    const submit = jest.fn();
    const host = {
      app: {},
      getConversationSync: jest.fn(),
      getConversationById: jest.fn(),
      submitSessionSectionTurn: submit,
    } as unknown as FeatureHost;

    const result = await activateSessionSectionAction({
      host,
      source: VALID_ACT,
      notePath: 'Notes/Spec.md',
      actionId: 'missing',
    });

    expect(result).toEqual({ status: 'blocked', reason: 'invalid-request' });
    expect(submit).not.toHaveBeenCalled();
    expect(confirmSessionSectionAction).not.toHaveBeenCalled();
  });
});
