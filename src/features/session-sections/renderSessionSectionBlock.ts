import type { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { TFile as ObsidianTFile } from 'obsidian';

import {
  parseSessionSectionYaml,
  SESSION_SECTION_FENCE_LANGUAGE,
} from '../../core/session-sections';
import type { FeatureHost } from '../FeatureHost';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';
import {
  renderInvalidSessionSection,
  renderSessionSectionWidget,
} from './SessionSectionWidget';

const DEAN_CONTAINER_SELECTOR = [
  '.dean-container',
  '.dean-inline-input-container',
  '.dean-inline-diff-preview',
  '.dean-inline-agent-reply',
  '.dean-message',
  '.dean-chat-panel',
].join(', ');

/**
 * Obsidian code-block processor for `dean-session`.
 * Host must be FeatureHost (not DeanPlugin-typed at the call site).
 */
export function renderSessionSectionBlock(
  host: FeatureHost,
  source: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): void {
  el.empty();

  // Always registered language: never leave a blank node. When inactive, show
  // the fence body as a plain code block so vault content stays visible.
  if (!host.settings.enableEditorSessionSections) {
    renderInactiveSessionSectionFence(el, source);
    return;
  }

  const sourcePath = ctx.sourcePath ?? '';
  if (!sourcePath || !sourcePath.endsWith('.md')) {
    renderInactiveSessionSectionFence(el, source);
    return;
  }

  if (isInsideDeanContainer(el)) {
    renderInactiveSessionSectionFence(el, source);
    return;
  }

  const abstract = host.app.vault.getAbstractFileByPath(sourcePath);
  if (!isVaultMarkdownFile(abstract)) {
    renderInactiveSessionSectionFence(el, source);
    return;
  }

  try {
    const section = parseSessionSectionYaml(source);
    renderSessionSectionWidget({
      host,
      containerEl: el,
      source,
      notePath: sourcePath,
      section,
      ctx,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid section';
    recordSessionSectionDiagnostic({
      level: 'warn',
      code: 'invalid-fence',
      message,
    });
    renderInvalidSessionSection(el, message);
  }
}

/** Non-interactive fallback so registered processors do not blank vault fences. */
export function renderInactiveSessionSectionFence(
  el: HTMLElement,
  source: string,
): void {
  el.empty();
  const pre = el.createEl('pre', { cls: 'dean-session-section-inactive language-dean-session' });
  pre.createEl('code', {
    cls: 'language-dean-session',
    text: source,
  });
}

export function isSessionSectionProcessorAllowed(
  host: FeatureHost,
  el: HTMLElement,
  sourcePath: string,
): boolean {
  if (!host.settings.enableEditorSessionSections) {
    return false;
  }
  if (!sourcePath || !sourcePath.endsWith('.md')) {
    return false;
  }
  if (isInsideDeanContainer(el)) {
    return false;
  }
  const abstract = host.app.vault.getAbstractFileByPath(sourcePath);
  return isVaultMarkdownFile(abstract);
}

export function isInsideDeanContainer(el: HTMLElement): boolean {
  if (typeof el.closest === 'function') {
    return !!el.closest(DEAN_CONTAINER_SELECTOR);
  }
  // Fallback walk for hosts / tests without Element.closest.
  let current: HTMLElement | null = el;
  while (current) {
    for (const cls of [
      'dean-container',
      'dean-inline-input-container',
      'dean-inline-diff-preview',
      'dean-inline-agent-reply',
      'dean-message',
      'dean-chat-panel',
    ]) {
      if (current.classList?.contains(cls)) {
        return true;
      }
    }
    current = current.parentElement;
  }
  return false;
}

function isVaultMarkdownFile(file: unknown): file is TFile {
  if (!file) {
    return false;
  }
  if (file instanceof ObsidianTFile) {
    return file.extension === 'md';
  }
  // Tests / partial mocks may not use the real TFile class.
  if (typeof file === 'object' && file !== null) {
    const candidate = file as { path?: unknown; extension?: unknown };
    return typeof candidate.path === 'string'
      && (candidate.extension === 'md' || candidate.path.endsWith('.md'));
  }
  return false;
}

export { SESSION_SECTION_FENCE_LANGUAGE };
