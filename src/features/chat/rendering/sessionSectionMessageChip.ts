import { setIcon } from 'obsidian';

import type { ExecutionInputSessionSectionSnapshot } from '../../../core/types';
import { t } from '../../../i18n/i18n';

export interface SessionSectionMessageChipOptions {
  readonly onOpenNote?: (notePath: string) => void;
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
      options.onOpenNote?.(section.notePath);
    });
  }

  return chip;
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
