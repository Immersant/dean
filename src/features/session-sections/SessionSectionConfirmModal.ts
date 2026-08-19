import { type App, Modal } from 'obsidian';

import { t } from '../../i18n/i18n';

export interface SessionSectionConfirmModalOptions {
  readonly conversationTitle: string;
  readonly conversationArchived?: boolean;
  readonly notePath: string;
  readonly actionLabel: string;
  readonly prompt: string;
  readonly stale?: boolean;
}

/**
 * Act confirm: conversation, note path, action label, and full prompt as plain text.
 * Does not markdown-render the prompt (markdown can hide instructions).
 */
export class SessionSectionConfirmModal extends Modal {
  private readonly options: SessionSectionConfirmModalOptions;
  private readonly resolve: (confirmed: boolean) => void;
  private resolved = false;

  constructor(
    app: App,
    options: SessionSectionConfirmModalOptions,
    resolve: (confirmed: boolean) => void,
  ) {
    super(app);
    this.options = options;
    this.resolve = resolve;
  }

  onOpen(): void {
    this.setTitle(t('settings.sessionSections.confirm.title'));
    this.modalEl.addClass('dean-session-section-confirm-modal');

    const meta = this.contentEl.createDiv({ cls: 'dean-session-section-confirm-meta' });
    const conversationLine = meta.createDiv({ cls: 'dean-session-section-confirm-row' });
    conversationLine.createSpan({
      cls: 'dean-session-section-confirm-label',
      text: t('settings.sessionSections.confirm.conversation'),
    });
    conversationLine.createSpan({
      cls: 'dean-session-section-confirm-value',
      text: this.options.conversationTitle,
    });
    if (this.options.conversationArchived) {
      conversationLine.createSpan({
        cls: 'dean-session-section-confirm-badge',
        text: t('settings.sessionSections.confirm.archived'),
      });
    }
    if (this.options.stale) {
      conversationLine.createSpan({
        cls: 'dean-session-section-confirm-badge dean-session-section-confirm-badge--stale',
        text: t('settings.sessionSections.confirm.stale'),
      });
    }

    const noteLine = meta.createDiv({ cls: 'dean-session-section-confirm-row' });
    noteLine.createSpan({
      cls: 'dean-session-section-confirm-label',
      text: t('settings.sessionSections.confirm.note'),
    });
    noteLine.createSpan({
      cls: 'dean-session-section-confirm-value',
      text: this.options.notePath,
    });

    const actionLine = meta.createDiv({ cls: 'dean-session-section-confirm-row' });
    actionLine.createSpan({
      cls: 'dean-session-section-confirm-label',
      text: t('settings.sessionSections.confirm.action'),
    });
    actionLine.createSpan({
      cls: 'dean-session-section-confirm-value',
      text: this.options.actionLabel,
    });

    this.contentEl.createDiv({
      cls: 'dean-session-section-confirm-prompt-label',
      text: t('settings.sessionSections.confirm.prompt'),
    });
    // Full prompt as plain text only — never innerHTML or MarkdownRenderer.
    this.contentEl.createEl('pre', {
      cls: 'dean-session-section-confirm-prompt',
      text: this.options.prompt,
    });

    const actions = this.contentEl.createDiv({ cls: 'dean-session-section-confirm-actions' });
    const cancelBtn = actions.createEl('button', {
      cls: 'dean-session-section-confirm-cancel',
      text: t('common.cancel'),
    });
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.addEventListener('click', () => this.close());

    const sendBtn = actions.createEl('button', {
      cls: 'dean-session-section-confirm-send mod-cta',
      text: t('settings.sessionSections.confirm.send'),
    });
    sendBtn.setAttribute('type', 'button');
    sendBtn.addEventListener('click', () => {
      this.resolved = true;
      this.resolve(true);
      this.close();
    });
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolve(false);
    }
    this.contentEl.empty();
  }
}

export function confirmSessionSectionAction(
  app: App,
  options: SessionSectionConfirmModalOptions,
): Promise<boolean> {
  return new Promise(resolve => {
    new SessionSectionConfirmModal(app, options, resolve).open();
  });
}
