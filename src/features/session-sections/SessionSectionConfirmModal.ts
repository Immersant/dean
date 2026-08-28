import { type App, Modal } from 'obsidian';

import { t } from '../../i18n/i18n';

export interface SessionSectionConfirmModalOptions {
  readonly notePath: string;
  readonly actionLabel: string;
  readonly draft: string;
  readonly allowSend: boolean;
  readonly stale?: boolean;
}

export type SessionSectionConfirmResult = 'cancelled' | 'send' | 'new-chat';

/**
 * New-chat confirm: note path, action label, and full draft as plain text.
 * Does not markdown-render the draft (markdown can hide instructions).
 */
export class SessionSectionConfirmModal extends Modal {
  private readonly options: SessionSectionConfirmModalOptions;
  private readonly resolve: (result: SessionSectionConfirmResult) => void;
  private resolved = false;

  constructor(
    app: App,
    options: SessionSectionConfirmModalOptions,
    resolve: (result: SessionSectionConfirmResult) => void,
  ) {
    super(app);
    this.options = options;
    this.resolve = resolve;
  }

  onOpen(): void {
    this.setTitle(t(
      this.options.allowSend
        ? 'settings.sessionSections.confirm.title'
        : 'settings.sessionSections.confirm.newChat',
    ));
    this.modalEl.addClass('dean-session-section-confirm-modal');

    const meta = this.contentEl.createDiv({ cls: 'dean-session-section-confirm-meta' });
    if (this.options.stale) {
      meta.createSpan({
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
    // Full draft as plain text only — never innerHTML or MarkdownRenderer.
    this.contentEl.createEl('pre', {
      cls: 'dean-session-section-confirm-prompt',
      text: this.options.draft,
    });

    const actions = this.contentEl.createDiv({ cls: 'dean-session-section-confirm-actions' });
    const cancelBtn = actions.createEl('button', {
      cls: 'dean-session-section-confirm-cancel',
      text: t('common.cancel'),
    });
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.addEventListener('click', () => this.close());

    const newChatBtn = actions.createEl('button', {
      cls: `dean-session-section-confirm-new-chat${this.options.allowSend ? '' : ' mod-cta'}`,
      text: t('settings.sessionSections.confirm.newChat'),
    });
    newChatBtn.setAttribute('type', 'button');
    newChatBtn.addEventListener('click', () => {
      this.resolved = true;
      this.resolve('new-chat');
      this.close();
    });

    if (this.options.allowSend) {
      const sendBtn = actions.createEl('button', {
        cls: 'dean-session-section-confirm-send mod-cta',
        text: t('settings.sessionSections.confirm.send'),
      });
      sendBtn.setAttribute('type', 'button');
      sendBtn.addEventListener('click', () => {
        this.resolved = true;
        this.resolve('send');
        this.close();
      });
    }
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolve('cancelled');
    }
    this.contentEl.empty();
  }
}

export function confirmSessionSectionAction(
  app: App,
  options: SessionSectionConfirmModalOptions,
): Promise<SessionSectionConfirmResult> {
  return new Promise(resolve => {
    new SessionSectionConfirmModal(app, options, resolve).open();
  });
}
