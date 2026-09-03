import type { FeatureHost } from '@/features/FeatureHost';
import { clearSessionSectionDiagnostics } from '@/features/session-sections/SessionSectionDiagnostics';
import { activateSessionSectionAction } from '@/features/session-sections/SessionSectionService';

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

  it('activateSessionSectionAction cancels without submit when user declines', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('cancelled');
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

  it('activateSessionSectionAction sends to the bound conversation when chosen', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('send');
    const submit = jest.fn().mockResolvedValue({ status: 'sent' });
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });
    const host = {
      app: {},
      getConversationSync: jest.fn().mockReturnValue({
        id: 'conv-1',
        title: 'Design session',
        isArchived: false,
      }),
      getConversationById: jest.fn(),
      submitSessionSectionTurn: submit,
      openSessionSectionDraft,
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
      expect.objectContaining({ canonicalText: 'Review this note carefully.' }),
    );
    expect(openSessionSectionDraft).not.toHaveBeenCalled();
    expect(confirmSessionSectionAction).toHaveBeenCalledWith(
      host.app,
      expect.objectContaining({
        notePath: 'Notes/Spec.md',
        actionLabel: 'Review',
        allowSend: true,
        draft: [
          '# Review',
          '',
          'Source note: Notes/Spec.md',
          '',
          'Review this note carefully.',
        ].join('\n'),
      }),
    );
  });

  it('opens a fresh unsent draft for an opted-in Act action', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('new-chat');
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });
    const submit = jest.fn();
    const getConversationSync = jest.fn();
    const getConversationById = jest.fn();
    const host = {
      app: {},
      getConversationSync,
      getConversationById,
      submitSessionSectionTurn: submit,
      openSessionSectionDraft,
    } as unknown as FeatureHost;

    const result = await activateSessionSectionAction({
      host,
      source: VALID_ACT.replace(
        'prompt: Review this note carefully.',
        'prompt: Review this note carefully.\n    startNewChat: true',
      ),
      notePath: 'Notes/Spec.md',
      actionId: 'review',
    });

    expect(result).toEqual({ status: 'opened' });
    expect(openSessionSectionDraft).toHaveBeenCalledWith({
      content: expect.stringContaining('Review this note carefully.'),
      sourceNotePath: 'Notes/Spec.md',
    });
    expect(confirmSessionSectionAction).toHaveBeenCalledTimes(1);
    expect(getConversationSync).not.toHaveBeenCalled();
    expect(getConversationById).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
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

  function hostWithVault(
    submit: jest.Mock,
    note = formNote(),
    openSessionSectionDraft?: jest.Mock,
  ) {
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
      ...(openSessionSectionDraft ? { openSessionSectionDraft } : {}),
    } as unknown as FeatureHost;
  }

  it('merges sibling formId answers into the confirmed Act draft', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('new-chat');
    const submit = jest.fn();
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });

    const result = await activateSessionSectionAction({
      host: hostWithVault(submit, formNote(), openSessionSectionDraft),
      source: FORM_DONE,
      notePath: 'Notes/Spec.md',
      actionId: 'done',
    });

    expect(result).toEqual({ status: 'opened' });
    const draft = openSessionSectionDraft.mock.calls[0][0].content as string;
    expect(draft).toContain('Which nav?');
    expect(draft).toContain('tabs');
    expect(draft).toContain('Comments');
    expect(draft).toContain('Keep it small.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('sends merged bound Collect answers when Send is chosen', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('send');
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
          formId: 'form_feedback',
          memberSectionIds: ['sec_nav', 'sec_done'],
          answers: { approach: 'tabs', notes: 'Keep it small.' },
        }),
      }),
    );
  });

  it('includes merged form answers in an opted-in Act new-chat draft', async () => {
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('new-chat');
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });
    const submit = jest.fn();
    const source = FORM_DONE.replace(
      'prompt: Continue from the merged answers.',
      'prompt: Continue from the merged answers.\n    startNewChat: true',
    );
    const note = formNote().replace(FORM_DONE, source);
    const formHost = hostWithVault(submit, note, openSessionSectionDraft);

    const result = await activateSessionSectionAction({
      host: formHost,
      source,
      notePath: 'Notes/Spec.md',
      actionId: 'done',
    });

    expect(result).toEqual({ status: 'opened' });
    expect(openSessionSectionDraft).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Continue from the merged answers.'),
    }));
    expect(openSessionSectionDraft.mock.calls[0][0].content).toContain('Which nav?');
    expect(openSessionSectionDraft.mock.calls[0][0].content).toContain('tabs');
    expect(openSessionSectionDraft.mock.calls[0][0].content).toContain('Comments');
    expect(openSessionSectionDraft.mock.calls[0][0].content).toContain('Keep it small.');
    expect(submit).not.toHaveBeenCalled();
    expect(confirmSessionSectionAction).toHaveBeenCalledTimes(1);
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
    jest.mocked(confirmSessionSectionAction).mockResolvedValue('new-chat');
    const submit = jest.fn();
    const openSessionSectionDraft = jest.fn().mockResolvedValue({ status: 'opened' });
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
      host: hostWithVault(submit, formNote(), openSessionSectionDraft),
      source: collectWithAnswers,
      notePath: 'Notes/Spec.md',
      actionId: 'review',
    });

    expect(result).toEqual({ status: 'opened' });
    const draft = openSessionSectionDraft.mock.calls[0][0].content as string;
    expect(draft).toContain('Comments');
    expect(draft).toContain('Only this fence');
    expect(submit).not.toHaveBeenCalled();
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
