import { createMockEl } from '@test/helpers/MockElement';

import {
  type BoundCollectSessionSection,
  serializeSessionSectionYaml,
  SESSION_SECTION_FENCE_LANGUAGE,
  type StandaloneCollectSessionSection,
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

jest.mock('@/features/session-sections/StandaloneCollectDraftService', () => ({
  openStandaloneCollectDraft: jest.fn().mockResolvedValue({ status: 'opened' }),
}));

import * as CollectRegistry from '@/features/session-sections/CollectSessionSectionRegistry';
import { activateSessionSectionAction } from '@/features/session-sections/SessionSectionService';
import {
  enableInteractiveEmbed,
} from '@/features/session-sections/SessionSectionWidget';
import { writeSessionSectionToNote } from '@/features/session-sections/SessionSectionWriteBack';
import { openStandaloneCollectDraft } from '@/features/session-sections/StandaloneCollectDraftService';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

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
  actions: [
    {
      id: 'done',
      label: "I'm done",
      prompt: 'Continue from the questionnaire answers in this note.',
    },
  ],
}) as BoundCollectSessionSection;

const BODY = 'schemaVersion: 1\nid: sec_collect\n';

const STANDALONE_SECTION = validateSessionSection({
  schemaVersion: 1,
  id: 'standalone_collect',
  kind: 'collect',
  title: 'Discovery',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: 'Start new chat',
  questions: [
    { id: 'goal', prompt: 'What should we build?', type: 'markdown' },
  ],
  answers: { goal: '' },
}) as StandaloneCollectSessionSection;

const STANDALONE_BODY = 'schemaVersion: 1\nid: standalone_collect\nstartNewChat: Start new chat\n';

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

function createCtx(): any {
  return {
    addChild: jest.fn((child: { load?: () => void }) => {
      child.load?.();
      return child;
    }),
    getSectionInfo: () => null,
  };
}

function renderStandaloneWidget(options: {
  host?: FeatureHost;
  ctx?: any;
} = {}): HTMLElement {
  const el = createMockEl() as unknown as HTMLElement;
  const host = options.host ?? ({
    app: { vault: {} },
    focusSessionSectionChat: jest.fn(),
    openSessionSectionDraft: jest.fn(),
    submitSessionSectionTurn: jest.fn(),
  } as unknown as FeatureHost);
  renderSessionSectionWidget({
    host,
    containerEl: el,
    source: STANDALONE_BODY,
    notePath: 'Notes/Discovery.md',
    section: STANDALONE_SECTION,
    ctx: Object.prototype.hasOwnProperty.call(options, 'ctx') ? options.ctx : createCtx(),
  });
  return el;
}

function renderBoundCollectWidget(host: FeatureHost): HTMLElement {
  const el = createMockEl() as unknown as HTMLElement;
  renderSessionSectionWidget({
    host,
    containerEl: el,
    source: BODY,
    notePath: 'Notes/Spec.md',
    section: SECTION,
    ctx: createCtx(),
  });
  return el;
}

describe('SessionSectionWidget Collect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearUsedSessionSectionActions();
    CollectRegistry.clearCollectSessionSectionRegistry();
  });

  it('renders Start new chat instead of Open chat for standalone Collect', () => {
    const el = createMockEl() as unknown as HTMLElement;
    const host = {
      app: { vault: {} },
      openSessionSectionDraft: jest.fn(),
    } as unknown as FeatureHost;
    const ctx = createCtx();

    renderSessionSectionWidget({
      host,
      containerEl: el,
      source: STANDALONE_BODY,
      notePath: 'Notes/Discovery.md',
      section: STANDALONE_SECTION,
      ctx,
    });

    const startChat = findByClass(el, 'dean-session-section-start-chat');
    expect(startChat).not.toBeNull();
    expect(startChat.textContent).toBe('Start new chat');
    expect(findByClass(el, 'dean-session-section-open-chat')).toBeNull();
    expect(el.getAttribute('data-conversation-id')).toBeNull();
  });

  it('uses the authored startNewChat string as the button label', () => {
    const section = validateSessionSection({
      schemaVersion: 1,
      id: 'standalone_collect',
      kind: 'collect',
      title: 'Discovery',
      status: 'open',
      createdAt: 1710000100000,
      startNewChat: 'Create the remix',
      questions: STANDALONE_SECTION.questions,
      answers: {},
    }) as StandaloneCollectSessionSection;
    const el = createMockEl() as unknown as HTMLElement;
    renderSessionSectionWidget({
      host: {
        app: { vault: {} },
        openSessionSectionDraft: jest.fn(),
      } as unknown as FeatureHost,
      containerEl: el,
      source: serializeSessionSectionYaml(section),
      notePath: 'Notes/Discovery.md',
      section,
      ctx: createCtx(),
    });
    expect(findByClass(el, 'dean-session-section-start-chat')?.textContent).toBe('Create the remix');
  });

  it('renders Start new chat only on the last formId member', () => {
    const first = validateSessionSection({
      schemaVersion: 1,
      id: 'sec_first',
      formId: 'form_split',
      kind: 'collect',
      title: 'Intent',
      status: 'open',
      createdAt: 1710000100000,
      startNewChat: 'Start new chat',
      questions: STANDALONE_SECTION.questions,
      answers: STANDALONE_SECTION.answers,
    }) as StandaloneCollectSessionSection;
    const last = validateSessionSection({
      schemaVersion: 1,
      id: 'sec_last',
      formId: 'form_split',
      kind: 'collect',
      title: 'Wrap-up',
      status: 'open',
      createdAt: 1710000100001,
      startNewChat: 'Start new chat',
      questions: STANDALONE_SECTION.questions,
      answers: STANDALONE_SECTION.answers,
    }) as StandaloneCollectSessionSection;
    const noteContent = [
      '```' + SESSION_SECTION_FENCE_LANGUAGE,
      serializeSessionSectionYaml(first).trimEnd(),
      '```',
      '',
      'Editor prose.',
      '',
      '```' + SESSION_SECTION_FENCE_LANGUAGE,
      serializeSessionSectionYaml(last).trimEnd(),
      '```',
    ].join('\n');
    const host = {
      app: { vault: {} },
      openSessionSectionDraft: jest.fn(),
    } as unknown as FeatureHost;

    const firstEl = createMockEl() as unknown as HTMLElement;
    renderSessionSectionWidget({
      host,
      containerEl: firstEl,
      source: serializeSessionSectionYaml(first),
      notePath: 'Notes/Split.md',
      section: first,
      ctx: createCtx(),
      noteContent,
    });
    const lastEl = createMockEl() as unknown as HTMLElement;
    renderSessionSectionWidget({
      host,
      containerEl: lastEl,
      source: serializeSessionSectionYaml(last),
      notePath: 'Notes/Split.md',
      section: last,
      ctx: createCtx(),
      noteContent,
    });

    expect(findByClass(firstEl, 'dean-session-section-start-chat')).toBeNull();
    expect(findByClass(lastEl, 'dean-session-section-start-chat')).not.toBeNull();
  });

  it('disables duplicate Start new chat clicks while opening', async () => {
    const opening = deferred<{ status: 'opened' }>();
    jest.mocked(openStandaloneCollectDraft).mockReturnValue(opening.promise);
    const el = renderStandaloneWidget();
    const button = findByClass(el, 'dean-session-section-start-chat');
    button.click();
    button.click();
    for (let i = 0; i < 20 && jest.mocked(openStandaloneCollectDraft).mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    expect(openStandaloneCollectDraft).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    opening.resolve({ status: 'opened' });
    await opening.promise;
  });

  it('keeps Start new chat locked across write-back remounts while opening', async () => {
    const opening = deferred<{ status: 'opened' }>();
    jest.mocked(openStandaloneCollectDraft).mockReturnValue(opening.promise);
    const firstEl = renderStandaloneWidget();
    const firstButton = findByClass(firstEl, 'dean-session-section-start-chat');
    firstButton.click();

    const remountedEl = renderStandaloneWidget();
    const remountedButton = findByClass(remountedEl, 'dean-session-section-start-chat');
    expect(remountedButton.hasAttribute('disabled')).toBe(true);
    expect(remountedButton.getAttribute('aria-busy')).toBe('true');

    remountedButton.click();
    for (let i = 0; i < 20 && jest.mocked(openStandaloneCollectDraft).mock.calls.length === 0; i++) {
      await Promise.resolve();
    }
    expect(openStandaloneCollectDraft).toHaveBeenCalledTimes(1);

    opening.resolve({ status: 'opened' });
    await opening.promise;
  });

  it('keeps bound Open chat and Act actions on their existing paths', async () => {
    const host = {
      app: { vault: {} },
      focusSessionSectionChat: jest.fn().mockResolvedValue({ status: 'focused' }),
      openSessionSectionDraft: jest.fn(),
      submitSessionSectionTurn: jest.fn(),
    } as unknown as FeatureHost;
    const el = renderBoundCollectWidget(host);
    findByClass(el, 'dean-session-section-open-chat').click();
    for (let i = 0; i < 20 && jest.mocked(host.focusSessionSectionChat).mock.calls.length === 0; i++) {
      await Promise.resolve();
    }

    expect(host.focusSessionSectionChat).toHaveBeenCalledWith('conv-1');
    expect(host.openSessionSectionDraft).not.toHaveBeenCalled();
    expect(host.submitSessionSectionTurn).not.toHaveBeenCalled();
  });

  it('disables Start new chat when answer write-back cannot be durable', () => {
    const el = renderStandaloneWidget({ ctx: undefined });
    const button = findByClass(el, 'dean-session-section-start-chat');
    expect(button).not.toBeNull();
    expect(button.hasAttribute('disabled')).toBe(true);
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

  it('applies author cssClass and style maps to the Collect widget', () => {
    const styled = validateSessionSection({
      ...SECTION,
      cssClass: 'board-card two-up',
      style: { display: 'grid', gap: '10px' },
      questions: [
        {
          ...SECTION.questions[0],
          cssClass: 'test-question choice-row',
          style: { 'flex-direction': 'row' },
        },
        SECTION.questions[1],
      ],
    }) as BoundCollectSessionSection;
    const el = createMockEl() as unknown as HTMLElement;
    renderSessionSectionWidget({
      host: {
        app: { vault: {} },
        submitSessionSectionTurn: jest.fn(),
        focusSessionSectionChat: jest.fn(),
      } as unknown as FeatureHost,
      containerEl: el,
      source: BODY,
      notePath: 'Notes/Spec.md',
      section: styled,
      ctx: createCtx(),
    });

    expect(el.classList.contains('board-card')).toBe(true);
    expect(el.classList.contains('two-up')).toBe(true);
    expect((el.style as unknown as Record<string, string>).display).toBe('grid');
    expect((el.style as unknown as Record<string, string>).gap).toBe('10px');
    const question = findByClass(el, 'choice-row');
    expect(question).toBeTruthy();
    expect((question.style as Record<string, string>)['flex-direction']).toBe('row');
  });

  it('Open chat focuses the sidebar conversation without submitting a turn', async () => {
    const flushSpy = jest.spyOn(CollectRegistry, 'flushCollectSessionSections');
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
    expect(flushSpy).not.toHaveBeenCalled();
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
      const usesCapture = !!call[2]
        && typeof call[2] === 'object'
        && (call[2] as { capture?: boolean }).capture === true;
      expect(usesCapture).toBe(false);
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
