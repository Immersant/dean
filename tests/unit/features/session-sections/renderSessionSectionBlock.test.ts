import { createMockEl } from '@test/helpers/MockElement';

import type { FeatureHost } from '@/features/FeatureHost';
import {
  isInsideDeanContainer,
  isSessionSectionProcessorAllowed,
  renderSessionSectionBlock,
} from '@/features/session-sections/renderSessionSectionBlock';
import { clearSessionSectionDiagnostics } from '@/features/session-sections/SessionSectionDiagnostics';

const VALID_ACT = `
schemaVersion: 1
id: sec_review
conversationId: conv-1
epoch: 0
kind: act
title: Follow-ups
status: open
createdAt: 1710000100000
actions:
  - id: review
    label: Review
    prompt: Review this note.
`.trim();

function createHost(overrides: {
  enable?: boolean;
  files?: Record<string, { path: string; extension: string }>;
} = {}): FeatureHost {
  const files = overrides.files ?? {
    'Notes/Spec.md': { path: 'Notes/Spec.md', extension: 'md' },
  };
  return {
    app: {
      vault: {
        getAbstractFileByPath: (path: string) => files[path] ?? null,
      },
    },
    settings: {
      enableEditorSessionSections: overrides.enable ?? true,
    },
    getConversationSync: jest.fn().mockReturnValue(null),
    getConversationById: jest.fn().mockResolvedValue(null),
    submitSessionSectionTurn: jest.fn().mockResolvedValue({ status: 'sent' }),
  } as unknown as FeatureHost;
}

function createCtx(sourcePath: string) {
  return { sourcePath } as any;
}

function findTag(el: any, tagName: string): any | null {
  if (el?.tagName === tagName) {
    return el;
  }
  for (const child of el?.children ?? []) {
    const found = findTag(child, tagName);
    if (found) {
      return found;
    }
  }
  return null;
}

describe('renderSessionSectionBlock', () => {
  beforeEach(() => {
    clearSessionSectionDiagnostics();
  });

  it('renders Act buttons when the flag is on and the path is a vault note', () => {
    const host = createHost();
    const el = createMockEl() as unknown as HTMLElement;

    renderSessionSectionBlock(host, VALID_ACT, el, createCtx('Notes/Spec.md'));

    expect(el.classList.contains('dean-session-section')).toBe(true);
    const button = el.querySelector('button.dean-session-section-action') as HTMLButtonElement | null;
    expect(button?.textContent).toBe('Review');
    expect(button?.getAttribute('data-action-id')).toBe('review');
  });

  it('shows inactive code fallback when the feature flag is off', () => {
    const host = createHost({ enable: false });
    const el = createMockEl() as any;

    renderSessionSectionBlock(host, VALID_ACT, el, createCtx('Notes/Spec.md'));

    expect(findTag(el, 'BUTTON')).toBeNull();
    const code = findTag(el, 'CODE');
    expect(code?.textContent).toContain('sec_review');
    expect(code?.textContent).toContain('kind: act');
  });

  it('shows inactive fallback for empty sourcePath (chat MessageRenderer)', () => {
    const host = createHost();
    const el = createMockEl() as any;

    renderSessionSectionBlock(host, VALID_ACT, el, createCtx(''));

    expect(findTag(el, 'BUTTON')).toBeNull();
    expect(findTag(el, 'CODE')?.textContent).toContain('sec_review');
  });

  it('shows inactive fallback inside a Dean chat container', () => {
    const host = createHost();
    const outer = createMockEl() as any;
    outer.classList.add('dean-container');
    const el = createMockEl() as any;
    outer.appendChild(el);

    renderSessionSectionBlock(host, VALID_ACT, el, createCtx('Notes/Spec.md'));

    expect(findTag(el, 'BUTTON')).toBeNull();
    expect(findTag(el, 'CODE')?.textContent).toContain('sec_review');
  });

  it('renders an invalid callout without buttons for bad YAML', () => {
    const host = createHost();
    const el = createMockEl() as unknown as HTMLElement;

    renderSessionSectionBlock(host, 'kind: not-a-section', el, createCtx('Notes/Spec.md'));

    expect(el.classList.contains('dean-session-section--invalid')).toBe(true);
    expect(el.querySelector('button')).toBeNull();
  });

  it('isSessionSectionProcessorAllowed enforces flag, path, and vault file', () => {
    const host = createHost();
    const el = createMockEl() as unknown as HTMLElement;
    expect(isSessionSectionProcessorAllowed(host, el, 'Notes/Spec.md')).toBe(true);
    expect(isSessionSectionProcessorAllowed(host, el, '')).toBe(false);
    expect(isSessionSectionProcessorAllowed(host, el, 'missing.md')).toBe(false);

    const deanEl = createMockEl() as unknown as HTMLElement;
    const wrap = createMockEl() as unknown as HTMLElement;
    wrap.classList.add('dean-chat-panel');
    wrap.appendChild(deanEl as unknown as Node);
    expect(isInsideDeanContainer(deanEl)).toBe(true);
    expect(isSessionSectionProcessorAllowed(host, deanEl, 'Notes/Spec.md')).toBe(false);
  });
});
