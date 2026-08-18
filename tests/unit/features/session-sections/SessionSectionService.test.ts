import { parseSessionSectionYaml } from '@/core/session-sections';
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
