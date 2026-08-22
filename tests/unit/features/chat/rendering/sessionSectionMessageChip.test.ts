import { createMockEl } from '@test/helpers/MockElement';
import { setIcon } from 'obsidian';

import type { ExecutionInputSessionSectionSnapshot } from '@/core/types';
import {
  formatSessionSectionChipDisclosure,
  formatSessionSectionOriginChipLabel,
  formatSessionSectionOriginChipTitle,
  renderSessionSectionMessageChip,
} from '@/features/chat/rendering/sessionSectionMessageChip';

jest.mock('obsidian', () => {
  const actual = jest.requireActual('obsidian');
  return {
    ...actual,
    setIcon: jest.fn(),
  };
});

const SECTION: ExecutionInputSessionSectionSnapshot = {
  sectionId: 'sec_mistral_intake',
  notePath: 'Notes/Onboard Mistral.md',
  conversationId: 'conv-1',
  kind: 'collect',
  actionId: 'intake_done',
  actionLabel: "I'm done — validate answers",
  title: 'Mistral provider intake',
};

describe('sessionSectionMessageChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats chip label from section title when present', () => {
    expect(formatSessionSectionOriginChipLabel(SECTION)).toBe('Mistral provider intake');
  });

  it('falls back to action label when title is missing', () => {
    expect(formatSessionSectionOriginChipLabel({
      ...SECTION,
      title: undefined,
    })).toMatch(/I'm done/);
  });

  it('formats tooltip with note path and action', () => {
    expect(formatSessionSectionOriginChipTitle(SECTION)).toBe(
      "Notes/Onboard Mistral.md · I'm done — validate answers",
    );
  });

  it('renders chip with note basename and opens note on click', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    const onOpenNote = jest.fn();
    renderSessionSectionMessageChip(contentEl, SECTION, { onOpenNote });

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('data-section-id')).toBe('sec_mistral_intake');
    expect(chip.getAttribute('data-note-path')).toBe('Notes/Onboard Mistral.md');
    expect(setIcon).toHaveBeenCalled();

    const main = findChild(chip, 'dean-session-section-message-chip-main');
    expect(main).toBeTruthy();
    expect(main.tagName).toBe('BUTTON');

    const pathEl = findChild(main, 'dean-session-section-message-chip-path');
    expect(pathEl?.textContent).toBe('Onboard Mistral.md');

    main.dispatchEvent('click', { preventDefault: () => {}, stopPropagation: () => {} });
    expect(onOpenNote).toHaveBeenCalledWith('Notes/Onboard Mistral.md', expect.any(Object));
  });

  it('omits prompt disclosure when the snapshot has no prompt', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    renderSessionSectionMessageChip(contentEl, SECTION);

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    expect(chip.hasClass('dean-session-section-message-chip--has-prompt')).toBe(false);
    expect(findChild(chip, 'dean-session-section-message-chip-toggle')).toBeUndefined();
    expect(findChild(chip, 'dean-session-section-message-chip-prompt')).toBeUndefined();
  });

  it('renders a collapsed prompt panel as plain text', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    const prompt = 'Review this note.\n<script>alert(1)</script>';
    renderSessionSectionMessageChip(contentEl, { ...SECTION, prompt });

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    expect(chip.hasClass('dean-session-section-message-chip--has-prompt')).toBe(true);

    const toggle = findChild(chip, 'dean-session-section-message-chip-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Show session section prompt');

    const promptEl = findChild(chip, 'dean-session-section-message-chip-prompt');
    expect(promptEl.tagName).toBe('PRE');
    expect(promptEl.hasClass('dean-hidden')).toBe(true);
    expect(promptEl.textContent).toBe(prompt);
  });

  it('toggles the prompt panel without opening the note', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    const onOpenNote = jest.fn();
    renderSessionSectionMessageChip(
      contentEl,
      { ...SECTION, prompt: 'Continue from the merged answers.' },
      { onOpenNote },
    );

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    const toggle = findChild(chip, 'dean-session-section-message-chip-toggle');
    const promptEl = findChild(chip, 'dean-session-section-message-chip-prompt');

    toggle.dispatchEvent('click', { preventDefault: () => {}, stopPropagation: () => {} });
    expect(onOpenNote).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide session section prompt');
    expect(chip.hasClass('expanded')).toBe(true);
    expect(promptEl.hasClass('dean-hidden')).toBe(false);

    toggle.dispatchEvent('click', { preventDefault: () => {}, stopPropagation: () => {} });
    expect(onOpenNote).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Show session section prompt');
    expect(chip.hasClass('expanded')).toBe(false);
    expect(promptEl.hasClass('dean-hidden')).toBe(true);
  });

  it('formats Collect questions and answers under the action prompt', () => {
    expect(formatSessionSectionChipDisclosure({
      ...SECTION,
      prompt: 'Continue from the merged answers.',
      questions: [
        {
          id: 'nav',
          prompt: 'Which navigation model?',
          type: 'single',
          options: [{ id: 'tabs', label: 'Tabs' }],
        },
        { id: 'comments', prompt: 'Comments', type: 'markdown' },
        {
          id: 'areas',
          prompt: 'Areas',
          type: 'multi',
          options: [
            { id: 'nav', label: 'Nav' },
            { id: 'search', label: 'Search' },
          ],
        },
        { id: 'notes', prompt: 'Notes', type: 'text' },
      ],
      answers: {
        nav: 'tabs',
        comments: 'Keep it small.',
        areas: ['nav', 'search'],
      },
    })).toBe([
      'Continue from the merged answers.',
      '',
      'Which navigation model?',
      'Tabs',
      '',
      'Comments',
      'Keep it small.',
      '',
      'Areas',
      'Nav',
      'Search',
      '',
      'Notes',
      'Not answered',
    ].join('\n'));
  });

  it('renders Collect questions and answers as plain text in the disclosure', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    const section: ExecutionInputSessionSectionSnapshot = {
      ...SECTION,
      prompt: 'Continue from the merged answers.',
      questions: [
        { id: 'comments', prompt: 'Say <done>\n<script>alert(1)</script>', type: 'text' },
      ],
      answers: { comments: 'Keep it small.' },
    };
    renderSessionSectionMessageChip(contentEl, section);

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    const promptEl = findChild(chip, 'dean-session-section-message-chip-prompt');
    expect(promptEl.textContent).toBe(formatSessionSectionChipDisclosure(section));
    expect(promptEl.textContent).toContain('Say <done>');
    expect(promptEl.textContent).toContain('<script>alert(1)</script>');
    expect(promptEl.textContent).toContain('Keep it small.');
  });

  it('shows disclosure for questions and answers even without an action prompt', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    renderSessionSectionMessageChip(contentEl, {
      ...SECTION,
      questions: [{ id: 'notes', prompt: 'Notes', type: 'text' }],
      answers: { notes: 'Ship it.' },
    });

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    expect(chip.hasClass('dean-session-section-message-chip--has-prompt')).toBe(true);
    expect(findChild(chip, 'dean-session-section-message-chip-toggle')).toBeTruthy();
    expect(findChild(chip, 'dean-session-section-message-chip-prompt').textContent).toBe(
      'Notes\nShip it.',
    );
  });

  it('opens the note from the chip body when a prompt is present', () => {
    const contentEl = createMockEl() as unknown as HTMLElement;
    const onOpenNote = jest.fn();
    renderSessionSectionMessageChip(
      contentEl,
      { ...SECTION, prompt: 'Continue from the merged answers.' },
      { onOpenNote },
    );

    const chip = findChild(contentEl, 'dean-session-section-message-chip');
    const main = findChild(chip, 'dean-session-section-message-chip-main');
    main.dispatchEvent('click', { preventDefault: () => {}, stopPropagation: () => {} });
    expect(onOpenNote).toHaveBeenCalledWith('Notes/Onboard Mistral.md', expect.any(Object));
  });
});

function findChild(parent: any, className: string): any {
  return parent.children.find((child: any) => child.hasClass?.(className));
}
