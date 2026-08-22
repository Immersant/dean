import { setIcon } from 'obsidian';

import type {
  ExecutionInputSessionSectionQuestionSnapshot,
  ExecutionInputSessionSectionSnapshot,
} from '../../../core/types';
import { t } from '../../../i18n/i18n';
import { setupCollapsible } from './collapsible';

export interface SessionSectionMessageChipOptions {
  readonly onOpenNote?: (notePath: string, event?: MouseEvent) => void;
}

/**
 * Chat history chip for a user turn that originated from an editor session section.
 * Pure presentation — MessageRenderer owns when to call this.
 */
export function renderSessionSectionMessageChip(
  contentEl: HTMLElement,
  section: ExecutionInputSessionSectionSnapshot,
  options: SessionSectionMessageChipOptions = {},
): HTMLElement {
  const chip = contentEl.createDiv({
    cls: 'dean-session-section-message-chip',
  });
  chip.setAttribute('data-section-id', section.sectionId);
  chip.setAttribute('data-note-path', section.notePath);
  chip.setAttribute('data-kind', section.kind);
  if (section.actionId) {
    chip.setAttribute('data-action-id', section.actionId);
  }

  const main = options.onOpenNote
    ? chip.createEl('button', {
      cls: 'dean-session-section-message-chip-main',
      attr: { type: 'button' },
    })
    : chip.createSpan({ cls: 'dean-session-section-message-chip-main' });

  const iconEl = main.createSpan({ cls: 'dean-session-section-message-chip-icon' });
  setIcon(iconEl, 'file-text');

  main.createSpan({
    cls: 'dean-session-section-message-chip-label',
    text: formatSessionSectionOriginChipLabel(section),
  });

  const noteName = basenamePath(section.notePath);
  if (noteName) {
    main.createSpan({
      cls: 'dean-session-section-message-chip-path',
      text: noteName,
    });
  }

  const title = formatSessionSectionOriginChipTitle(section);
  main.setAttribute('title', title);
  main.setAttribute(
    'aria-label',
    t('settings.sessionSections.chip.openNoteAria', { path: section.notePath }),
  );

  if (options.onOpenNote) {
    main.addEventListener('click', (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      options.onOpenNote?.(section.notePath, event);
    });
  }

  const disclosure = formatSessionSectionChipDisclosure(section);
  if (disclosure) {
    chip.addClass('dean-session-section-message-chip--has-prompt');

    const toggle = chip.createEl('button', {
      cls: 'dean-session-section-message-chip-toggle',
      attr: { type: 'button' },
    });
    const toggleIcon = toggle.createSpan({
      cls: 'dean-session-section-message-chip-toggle-icon',
    });
    setIcon(toggleIcon, 'chevron-down');
    setPromptToggleAria(toggle, false);

    const promptEl = chip.createEl('pre', {
      cls: 'dean-session-section-message-chip-prompt',
      text: disclosure,
    });

    setupCollapsible(chip, toggle, promptEl, { isExpanded: false }, {
      onToggle: isExpanded => setPromptToggleAria(toggle, isExpanded),
    });
    toggle.addEventListener('click', (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
    });
  }

  return chip;
}

export function formatSessionSectionChipDisclosure(
  section: ExecutionInputSessionSectionSnapshot,
): string | undefined {
  const blocks: string[] = [];
  if (typeof section.prompt === 'string' && section.prompt.trim()) {
    blocks.push(section.prompt);
  }
  const qa = formatSessionSectionChipQuestions(section);
  if (qa) {
    blocks.push(qa);
  }
  return blocks.length > 0 ? blocks.join('\n\n') : undefined;
}

function formatSessionSectionChipQuestions(
  section: ExecutionInputSessionSectionSnapshot,
): string | undefined {
  const answers = section.answers ?? {};
  const consumed = new Set<string>();
  const blocks: string[] = [];

  for (const question of section.questions ?? []) {
    consumed.add(question.id);
    blocks.push(formatQuestionBlock(question.prompt, answers[question.id], question));
  }
  for (const [id, value] of Object.entries(answers)) {
    if (consumed.has(id)) {
      continue;
    }
    blocks.push(formatQuestionBlock(id, value, undefined));
  }
  return blocks.length > 0 ? blocks.join('\n\n') : undefined;
}

function formatQuestionBlock(
  heading: string,
  value: string | string[] | undefined,
  question: ExecutionInputSessionSectionQuestionSnapshot | undefined,
): string {
  const answerLines = formatAnswerLines(value, question);
  if (answerLines.length === 0) {
    answerLines.push(t('settings.sessionSections.newChatDraft.notAnswered'));
  }
  return [heading, ...answerLines].join('\n');
}

function formatAnswerLines(
  value: string | string[] | undefined,
  question: ExecutionInputSessionSectionQuestionSnapshot | undefined,
): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? [value]
      : [];
  const lines: string[] = [];
  for (const item of values) {
    if (!item.trim()) {
      continue;
    }
    lines.push(question?.options?.find(option => option.id === item)?.label ?? item);
  }
  return lines;
}

function setPromptToggleAria(toggle: HTMLElement, isExpanded: boolean): void {
  toggle.setAttribute(
    'aria-label',
    isExpanded
      ? t('settings.sessionSections.chip.hidePromptAria')
      : t('settings.sessionSections.chip.showPromptAria'),
  );
}

export function formatSessionSectionOriginChipLabel(
  section: ExecutionInputSessionSectionSnapshot,
): string {
  const title = section.title?.trim();
  if (title) {
    return title;
  }
  if (section.actionLabel?.trim()) {
    return t('settings.sessionSections.displayLabel', {
      label: section.actionLabel.trim(),
    });
  }
  if (section.actionId?.trim()) {
    return t('settings.sessionSections.displayLabel', {
      label: section.actionId.trim(),
    });
  }
  return t('settings.sessionSections.chip.fallback');
}

export function formatSessionSectionOriginChipTitle(
  section: ExecutionInputSessionSectionSnapshot,
): string {
  const parts: string[] = [section.notePath];
  if (section.actionLabel?.trim()) {
    parts.push(section.actionLabel.trim());
  } else if (section.actionId?.trim()) {
    parts.push(section.actionId.trim());
  }
  return parts.join(' · ');
}

function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}
