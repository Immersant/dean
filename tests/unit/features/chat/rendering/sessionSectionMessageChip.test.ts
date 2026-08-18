import { createMockEl } from '@test/helpers/MockElement';
import { setIcon } from 'obsidian';

import type { ExecutionInputSessionSectionSnapshot } from '@/core/types';
import {
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

    const chip = (contentEl as any).children.find(
      (child: any) => child.hasClass?.('dean-session-section-message-chip'),
    );
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('data-section-id')).toBe('sec_mistral_intake');
    expect(chip.getAttribute('data-note-path')).toBe('Notes/Onboard Mistral.md');
    expect(setIcon).toHaveBeenCalled();

    const main = chip.children.find(
      (child: any) => child.hasClass?.('dean-session-section-message-chip-main'),
    );
    expect(main).toBeTruthy();
    expect(main.tagName).toBe('BUTTON');

    const pathEl = main.children.find(
      (child: any) => child.hasClass?.('dean-session-section-message-chip-path'),
    );
    expect(pathEl?.textContent).toBe('Onboard Mistral.md');

    main.dispatchEvent('click', { preventDefault: () => {}, stopPropagation: () => {} });
    expect(onOpenNote).toHaveBeenCalledWith('Notes/Onboard Mistral.md');
  });
});
