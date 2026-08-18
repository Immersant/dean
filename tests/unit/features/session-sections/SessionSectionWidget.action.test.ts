import { setIcon } from 'obsidian';

import { createMockEl } from '@test/helpers/MockElement';

import {
  type SessionSection,
  validateSessionSection,
} from '@/core/session-sections';
import type { FeatureHost } from '@/features/FeatureHost';
import {
  clearUsedSessionSectionActions,
  renderSessionSectionWidget,
} from '@/features/session-sections/SessionSectionWidget';

jest.mock('@/features/session-sections/SessionSectionService', () => ({
  activateSessionSectionAction: jest.fn().mockResolvedValue({ status: 'sent' }),
}));

import { activateSessionSectionAction } from '@/features/session-sections/SessionSectionService';

const SECTION: SessionSection = validateSessionSection({
  schemaVersion: 1,
  id: 'sec_review',
  conversationId: 'conv-1',
  epoch: 0,
  kind: 'act',
  title: 'Follow-ups',
  status: 'open',
  createdAt: 1710000100000,
  actions: [
    {
      id: 'review',
      label: 'Review',
      prompt: 'Review this note.',
    },
  ],
});

const BODY = 'schemaVersion: 1\nid: sec_review\n';

function findByClass(el: any, cls: string): any | null {
  if (el?.hasClass?.(cls) || el?.classList?.contains?.(cls)) {
    return el;
  }
  for (const child of el?.children ?? []) {
    const found = findByClass(child, cls);
    if (found) return found;
  }
  return null;
}

function renderWidget(containerEl: HTMLElement): void {
  const host = {
    app: { vault: {} },
    submitSessionSectionTurn: jest.fn(),
  } as unknown as FeatureHost;
  renderSessionSectionWidget({
    host,
    containerEl,
    source: BODY,
    notePath: 'Notes/Spec.md',
    section: SECTION,
  });
}

async function clickAction(el: any): Promise<void> {
  const button = findByClass(el, 'dean-session-section-action');
  button.click();
  for (let i = 0; i < 20 && jest.mocked(activateSessionSectionAction).mock.calls.length === 0; i++) {
    await Promise.resolve();
  }
}

describe('SessionSectionWidget Act disable/reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearUsedSessionSectionActions();
  });

  it('does not render Open chat on Act-only sections', () => {
    const el = createMockEl() as unknown as HTMLElement;
    renderWidget(el);
    expect(findByClass(el, 'dean-session-section-open-chat')).toBeNull();
  });

  it('keeps the Act button disabled after click and shows a reset control', async () => {
    const el = createMockEl() as unknown as HTMLElement;
    renderWidget(el);

    const button = findByClass(el, 'dean-session-section-action');
    const reset = findByClass(el, 'dean-session-section-action-reset');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(reset).toBeTruthy();
    expect(setIcon).toHaveBeenCalledWith(reset, 'rotate-ccw');

    await clickAction(el);

    expect(activateSessionSectionAction).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(findByClass(el, 'dean-session-section-action-row')?.hasClass(
      'dean-session-section-action-row--used',
    )).toBe(true);

    button.click();
    await Promise.resolve();
    expect(activateSessionSectionAction).toHaveBeenCalledTimes(1);
  });

  it('reset re-enables the Act button so it can be submitted again', async () => {
    const el = createMockEl() as unknown as HTMLElement;
    renderWidget(el);

    await clickAction(el);
    const button = findByClass(el, 'dean-session-section-action');
    expect(button.hasAttribute('disabled')).toBe(true);

    findByClass(el, 'dean-session-section-action-reset').click();

    expect(button.hasAttribute('disabled')).toBe(false);
    expect(findByClass(el, 'dean-session-section-action-row')?.hasClass(
      'dean-session-section-action-row--used',
    )).toBe(false);

    await clickAction(el);
    expect(activateSessionSectionAction).toHaveBeenCalledTimes(2);
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('remounts a used action as disabled until reset', async () => {
    const first = createMockEl() as unknown as HTMLElement;
    renderWidget(first);
    await clickAction(first);

    const remount = createMockEl() as unknown as HTMLElement;
    renderWidget(remount);

    const button = findByClass(remount, 'dean-session-section-action');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(findByClass(remount, 'dean-session-section-action-row')?.hasClass(
      'dean-session-section-action-row--used',
    )).toBe(true);

    findByClass(remount, 'dean-session-section-action-reset').click();
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});
