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

jest.mock('@/features/session-sections/SessionSectionWriteBack', () => {
  const actual = jest.requireActual('@/features/session-sections/SessionSectionWriteBack');
  return {
    ...actual,
    writeSessionSectionToNote: jest.fn().mockResolvedValue({ status: 'written' }),
  };
});

import { activateSessionSectionAction } from '@/features/session-sections/SessionSectionService';
import {
  enableInteractiveEmbed,
} from '@/features/session-sections/SessionSectionWidget';
import { writeSessionSectionToNote } from '@/features/session-sections/SessionSectionWriteBack';

const SECTION: SessionSection = validateSessionSection({
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
  actions: [
    {
      id: 'done',
      label: "I'm done",
      prompt: 'Continue from the questionnaire answers in this note.',
    },
  ],
});

const BODY = 'schemaVersion: 1\nid: sec_collect\n';

function findInputs(el: any, type: string): any[] {
  const results: any[] = [];
  const walk = (node: any) => {
    if (node?.tagName === 'INPUT' && node.getAttribute?.('type') === type) {
      results.push(node);
    }
    for (const child of node?.children ?? []) {
      walk(child);
    }
  };
  walk(el);
  return results;
}

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

function findButton(el: any): any | null {
  return findByClass(el, 'dean-session-section-action');
}

describe('SessionSectionWidget Collect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearUsedSessionSectionActions();
  });

  it('renders interactive Collect controls and Act buttons', () => {
    const el = createMockEl() as unknown as HTMLElement;
    const host = {
      app: { vault: {} },
      submitSessionSectionTurn: jest.fn(),
    } as unknown as FeatureHost;
    const ctx = {
      addChild: jest.fn((child: unknown) => child),
      getSectionInfo: () => null,
    } as any;

    renderSessionSectionWidget({
      host,
      containerEl: el,
      source: BODY,
      notePath: 'Notes/Spec.md',
      section: SECTION,
      ctx,
    });

    expect(ctx.addChild).toHaveBeenCalled();
    expect(findInputs(el, 'radio').length).toBe(2);
    expect(findByClass(el, 'dean-session-section-question-input')).not.toBeNull();
    expect(findButton(el)?.textContent).toContain("I'm done");
    expect(findByClass(el, 'dean-session-section-open-chat-label')?.textContent).toContain('Open chat');
  });

  it('Open chat focuses the sidebar conversation without submitting a turn', async () => {
    const el = createMockEl() as unknown as HTMLElement;
    const host = {
      app: { vault: {} },
      submitSessionSectionTurn: jest.fn(),
      focusSessionSectionChat: jest.fn().mockResolvedValue({ status: 'focused' }),
    } as unknown as FeatureHost;
    const ctx = {
      addChild: jest.fn((child: unknown) => child),
      getSectionInfo: () => null,
    } as any;

    renderSessionSectionWidget({
      host,
      containerEl: el,
      source: BODY,
      notePath: 'Notes/Spec.md',
      section: SECTION,
      ctx,
    });

    findByClass(el, 'dean-session-section-open-chat').click();
    for (let i = 0; i < 20 && jest.mocked(host.focusSessionSectionChat).mock.calls.length === 0; i++) {
      await Promise.resolve();
    }

    expect(host.focusSessionSectionChat).toHaveBeenCalledWith('conv-1');
    expect(host.submitSessionSectionTurn).not.toHaveBeenCalled();
    expect(activateSessionSectionAction).not.toHaveBeenCalled();
  });

  it('flushes Collect answers on radio change without chat submit', async () => {
    jest.useFakeTimers();
    const el = createMockEl() as unknown as HTMLElement;
    const host = {
      app: { vault: {} },
      submitSessionSectionTurn: jest.fn(),
    } as unknown as FeatureHost;
    const ctx = {
      addChild: jest.fn((child: { load?: () => void }) => {
        child.load?.();
        return child;
      }),
      getSectionInfo: () => null,
    } as any;

    renderSessionSectionWidget({
      host,
      containerEl: el,
      source: BODY,
      notePath: 'Notes/Spec.md',
      section: SECTION,
      ctx,
    });

    expect(el.getAttribute('contenteditable')).toBe('false');

    const sessions = findInputs(el, 'radio').find(
      (input: any) => input.getAttribute('value') === 'sessions',
    );
    expect(sessions).toBeTruthy();
    sessions.checked = true;
    sessions.dispatchEvent('change');
    expect(writeSessionSectionToNote).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();

    expect(writeSessionSectionToNote).toHaveBeenCalled();
    expect(host.submitSessionSectionTurn).not.toHaveBeenCalled();
    expect(activateSessionSectionAction).not.toHaveBeenCalled();
    jest.useRealTimers();
  });


  it('enableInteractiveEmbed stops pointer events in bubble phase, not capture', () => {
    const el = createMockEl() as unknown as HTMLElement;
    const spy = jest.spyOn(el, 'addEventListener');
    enableInteractiveEmbed(el);
    const pointerCalls = spy.mock.calls.filter(call =>
      ['mousedown', 'pointerdown', 'touchstart', 'click'].includes(String(call[0])),
    );
    expect(pointerCalls.length).toBeGreaterThan(0);
    for (const call of pointerCalls) {
      // Capture would be true as the third argument and would block Act button clicks.
      expect(call[2]).not.toBe(true);
      if (call[2] && typeof call[2] === 'object') {
        expect((call[2] as { capture?: boolean }).capture).not.toBe(true);
      }
    }
  });

  it('Act button flushes then activates with answers in the fence source', async () => {
    const el = createMockEl() as unknown as HTMLElement;
    const host = {
      app: { vault: {} },
      submitSessionSectionTurn: jest.fn(),
    } as unknown as FeatureHost;
    const ctx = {
      addChild: jest.fn((child: { load?: () => void }) => {
        child.load?.();
        return child;
      }),
      getSectionInfo: () => null,
    } as any;

    renderSessionSectionWidget({
      host,
      containerEl: el,
      source: BODY,
      notePath: 'Notes/Spec.md',
      section: SECTION,
      ctx,
    });

    const textInput = findByClass(el, 'dean-session-section-question-input');
    if (textInput) {
      textInput.value = 'ship tabs';
      textInput.dispatchEvent('input');
    }

    const button = findButton(el);
    button.click();

    for (let i = 0; i < 20 && jest.mocked(activateSessionSectionAction).mock.calls.length === 0; i++) {
      await Promise.resolve();
    }

    expect(writeSessionSectionToNote).toHaveBeenCalled();
    expect(activateSessionSectionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'done',
        notePath: 'Notes/Spec.md',
        source: expect.stringContaining('ship tabs'),
      }),
    );
  });
});
