import type { MarkdownPostProcessorContext } from 'obsidian';
import { Notice, setIcon } from 'obsidian';

import type {
  SessionSection,
  SessionSectionAnswers,
  SessionSectionQuestion,
  StandaloneCollectSessionSection,
} from '../../core/session-sections';
import {
  isBoundSessionSection,
  isStandaloneCollectSessionSection,
  serializeSessionSectionYaml,
} from '../../core/session-sections';
import { t } from '../../i18n/i18n';
import type { FeatureHost } from '../FeatureHost';
import { CollectSessionSectionController } from './CollectSessionSectionController';
import { recordSessionSectionDiagnostic } from './SessionSectionDiagnostics';
import { activateSessionSectionAction } from './SessionSectionService';
import { openStandaloneCollectDraft } from './StandaloneCollectDraftService';

const usedActions = new Set<string>();
const openingStandaloneCollectDrafts = new Set<string>();

function usedActionKey(notePath: string, sectionId: string, actionId: string): string {
  return `${notePath}\0${sectionId}\0${actionId}`;
}

function standaloneCollectDraftKey(notePath: string, sectionId: string): string {
  return `${notePath}\0${sectionId}`;
}

export function clearUsedSessionSectionActions(): void {
  usedActions.clear();
  openingStandaloneCollectDrafts.clear();
}

export interface RenderSessionSectionWidgetOptions {
  readonly host: FeatureHost;
  readonly containerEl: HTMLElement;
  readonly source: string;
  readonly notePath: string;
  readonly section: SessionSection;
  readonly ctx?: MarkdownPostProcessorContext;
}

/**
 * Renders one validated session section.
 * Act buttons send via FeatureHost after confirm.
 * Collect inputs write answers into the note only (no chat send).
 */
export function renderSessionSectionWidget(
  options: RenderSessionSectionWidgetOptions,
): void {
  const { host, containerEl, source, notePath, section, ctx } = options;
  containerEl.empty();
  containerEl.addClass('dean-session-section');
  // Live Preview embeds sit under CodeMirror; without this, CM steals mousedown
  // and radios/checkboxes/text fields never activate.
  enableInteractiveEmbed(containerEl);
  if (section.status === 'stale') {
    containerEl.addClass('dean-session-section--stale');
  }
  containerEl.setAttribute('data-section-id', section.id);
  if (isBoundSessionSection(section)) {
    containerEl.setAttribute('data-conversation-id', section.conversationId);
  }
  containerEl.setAttribute('data-kind', section.kind);

  const header = containerEl.createDiv({ cls: 'dean-session-section-header' });
  header.createDiv({
    cls: 'dean-session-section-title',
    text: section.title,
  });
  const badges = header.createDiv({ cls: 'dean-session-section-badges' });
  badges.createSpan({
    cls: 'dean-session-section-badge',
    text: section.kind === 'act'
      ? t('settings.sessionSections.badge.act')
      : t('settings.sessionSections.badge.collect'),
  });
  if (section.status === 'stale') {
    badges.createSpan({
      cls: 'dean-session-section-badge dean-session-section-badge--stale',
      text: t('settings.sessionSections.badge.stale'),
    });
  }

  if (section.kind === 'collect' && isBoundSessionSection(section) && section.questions.length > 0) {
    renderOpenChatButton(header, host, section.conversationId);
  }

  let collect: CollectSessionSectionController | null = null;
  if (section.kind === 'collect' && section.questions.length > 0 && ctx) {
    collect = new CollectSessionSectionController({
      app: host.app,
      el: containerEl,
      ctx,
      notePath,
      section,
      originalSource: source,
    });
    ctx.addChild(collect);
    renderCollectForm(containerEl, section, collect);
  } else if (section.kind === 'collect' && section.questions.length > 0) {
    // No processor context (tests / unexpected host): still show interactive controls
    // but write-back requires ctx, so show a note.
    renderCollectForm(containerEl, section, null);
    containerEl.createDiv({
      cls: 'dean-session-section-collect-note',
      text: t('settings.sessionSections.collect.writeBackUnavailable'),
    });
  }

  if (isStandaloneCollectSessionSection(section)) {
    renderStartNewChatButton(containerEl, {
      host,
      notePath,
      section,
      collect,
    });
  }

  if (isBoundSessionSection(section) && section.actions.length > 0) {
    const actionsEl = containerEl.createDiv({ cls: 'dean-session-section-actions' });
    for (const action of section.actions) {
      renderActionButton(actionsEl, {
        host,
        source,
        notePath,
        sectionId: section.id,
        actionId: action.id,
        actionLabel: action.label,
        collect,
      });
    }
  }
}

function renderStartNewChatButton(
  containerEl: HTMLElement,
  options: {
    readonly host: FeatureHost;
    readonly notePath: string;
    readonly section: StandaloneCollectSessionSection;
    readonly collect: CollectSessionSectionController | null;
  },
): void {
  const { host, notePath, section, collect } = options;
  const openingKey = standaloneCollectDraftKey(notePath, section.id);
  const actionsEl = containerEl.createDiv({ cls: 'dean-session-section-actions' });
  const button = actionsEl.createEl('button', {
    cls: 'dean-session-section-start-chat',
    text: t('settings.sessionSections.newChat.label'),
  });
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', t('settings.sessionSections.newChat.aria'));
  button.setAttribute('title', t('settings.sessionSections.newChat.aria'));
  enableInteractiveControl(button);
  if (!collect) {
    button.setAttribute('disabled', 'true');
  } else if (openingStandaloneCollectDrafts.has(openingKey)) {
    button.setAttribute('disabled', 'true');
    button.setAttribute('aria-busy', 'true');
  }
  containerEl.createDiv({
    cls: 'dean-session-section-collect-note',
    text: t('settings.sessionSections.newChat.hint'),
  });

  button.addEventListener('click', (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    if (!collect || openingStandaloneCollectDrafts.has(openingKey) || button.hasAttribute('disabled')) {
      return;
    }
    openingStandaloneCollectDrafts.add(openingKey);
    button.setAttribute('disabled', 'true');
    button.setAttribute('aria-busy', 'true');
    void (async () => {
      try {
        const result = await openStandaloneCollectDraft({
          host,
          section,
          notePath,
          collect,
        });
        if (result.status === 'blocked' && result.reason === 'writeback-failed') {
          new Notice(t('settings.sessionSections.blocked.writeBackFailed'));
        }
      } finally {
        openingStandaloneCollectDrafts.delete(openingKey);
        if (button.isConnected) {
          button.removeAttribute('aria-busy');
          button.removeAttribute('disabled');
        }
      }
    })();
  });
}

function renderOpenChatButton(
  parentEl: HTMLElement,
  host: FeatureHost,
  conversationId: string,
): void {
  const button = parentEl.createEl('button', {
    cls: 'dean-session-section-open-chat',
  });
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', t('settings.sessionSections.openChat.aria'));
  button.setAttribute('title', t('settings.sessionSections.openChat.aria'));
  const icon = button.createSpan({ cls: 'dean-session-section-open-chat-icon' });
  setIcon(icon, 'message-square');
  button.createSpan({
    cls: 'dean-session-section-open-chat-label',
    text: t('settings.sessionSections.openChat.label'),
  });
  enableInteractiveControl(button);

  let focusing = false;
  button.addEventListener('click', (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    if (focusing || button.hasAttribute('disabled')) {
      return;
    }
    focusing = true;
    button.setAttribute('disabled', 'true');
    void (async () => {
      try {
        const result = await host.focusSessionSectionChat(conversationId);
        recordSessionSectionDiagnostic({
          level: result.status === 'blocked' ? 'warn' : 'info',
          code: result.status === 'blocked' ? 'focus-chat-blocked' : 'focus-chat',
          message: result.status === 'blocked'
            ? `Blocked: ${result.reason}`
            : 'Opened session-section chat',
          conversationId,
        });
      } finally {
        focusing = false;
        try {
          button.removeAttribute('disabled');
        } catch {
          // Widget may have remounted.
        }
      }
    })();
  });
}

function renderActionButton(
  actionsEl: HTMLElement,
  options: {
    readonly host: FeatureHost;
    readonly source: string;
    readonly notePath: string;
    readonly sectionId: string;
    readonly actionId: string;
    readonly actionLabel: string;
    readonly collect: CollectSessionSectionController | null;
  },
): void {
  const { host, source, notePath, sectionId, actionId, actionLabel, collect } = options;
  const key = usedActionKey(notePath, sectionId, actionId);
  const row = actionsEl.createDiv({ cls: 'dean-session-section-action-row' });

  const button = row.createEl('button', {
    cls: 'dean-session-section-action',
    text: actionLabel,
  });
  button.setAttribute('type', 'button');
  button.setAttribute('data-action-id', actionId);
  enableInteractiveControl(button);

  const reset = row.createEl('button', { cls: 'dean-session-section-action-reset' });
  reset.setAttribute('type', 'button');
  reset.setAttribute('aria-label', t('settings.sessionSections.action.resetAria'));
  reset.setAttribute('title', t('settings.sessionSections.action.resetAria'));
  setIcon(reset, 'rotate-ccw');
  enableInteractiveControl(reset);

  const applyUsedState = (used: boolean): void => {
    if (used) {
      usedActions.add(key);
      button.setAttribute('disabled', 'true');
      row.addClass('dean-session-section-action-row--used');
    } else {
      usedActions.delete(key);
      button.removeAttribute('disabled');
      row.removeClass('dean-session-section-action-row--used');
    }
  };

  applyUsedState(usedActions.has(key));

  let submitting = false;
  button.addEventListener('click', (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    if (button.hasAttribute('disabled') || submitting) {
      return;
    }
    submitting = true;
    applyUsedState(true);
    // Snapshot before flush: vault.modify remounts the processor and drops this DOM.
    const sourceForAct = collect
      ? serializeSessionSectionYaml(collect.getSectionWithAnswers())
      : source;
    void (async () => {
      try {
        if (collect) {
          await collect.flush();
        }
        await activateSessionSectionAction({
          host,
          source: sourceForAct,
          notePath,
          actionId,
        });
      } finally {
        submitting = false;
      }
    })();
  });

  reset.addEventListener('click', (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    if (submitting) {
      return;
    }
    applyUsedState(false);
  });
}

function renderCollectForm(
  containerEl: HTMLElement,
  section: SessionSection,
  collect: CollectSessionSectionController | null,
): void {
  const questionsEl = containerEl.createDiv({ cls: 'dean-session-section-questions' });
  const answers = collect?.getAnswers() ?? { ...section.answers };

  for (const question of section.questions) {
    const item = questionsEl.createDiv({ cls: 'dean-session-section-question' });
    item.createDiv({
      cls: 'dean-session-section-question-prompt',
      text: question.prompt,
    });
    renderQuestionControl(item, section.id, question, answers, collect);
  }

  questionsEl.createDiv({
    cls: 'dean-session-section-collect-note',
    text: t('settings.sessionSections.collect.hint'),
  });
}

function renderQuestionControl(
  item: HTMLElement,
  sectionId: string,
  question: SessionSectionQuestion,
  answers: SessionSectionAnswers,
  collect: CollectSessionSectionController | null,
): void {
  const current = answers[question.id];

  if (question.type === 'single' && question.options) {
    const group = item.createDiv({ cls: 'dean-session-section-question-options' });
    // Include section id so multiple fences on one note do not share radio groups.
    const groupName = `dean-session-${sectionId}-q-${question.id}`;
    for (const option of question.options) {
      const inputId = `${groupName}-${option.id}`;
      const label = group.createEl('label', {
        cls: 'dean-session-section-question-option',
        attr: { for: inputId },
      });
      const input = label.createEl('input', {
        attr: {
          type: 'radio',
          name: groupName,
          value: option.id,
          id: inputId,
        },
      });
      enableInteractiveControl(input);
      enableInteractiveControl(label);
      if (current === option.id) {
        input.setAttribute('checked', 'true');
        (input).checked = true;
      }
      label.createSpan({ text: option.label });
      input.addEventListener('change', () => {
        if (!(input).checked) {
          return;
        }
        collect?.setSingleAnswer(question.id, option.id);
        // Debounce so the browser paints the checked state before vault.modify remounts.
        collect?.scheduleFlush();
      });
    }
    return;
  }

  if (question.type === 'multi' && question.options) {
    const group = item.createDiv({ cls: 'dean-session-section-question-options' });
    const selected = new Set(
      Array.isArray(current) ? current : typeof current === 'string' && current ? [current] : [],
    );
    for (const option of question.options) {
      const inputId = `dean-session-${sectionId}-q-${question.id}-${option.id}`;
      const label = group.createEl('label', {
        cls: 'dean-session-section-question-option',
        attr: { for: inputId },
      });
      const input = label.createEl('input', {
        attr: {
          type: 'checkbox',
          value: option.id,
          id: inputId,
        },
      });
      enableInteractiveControl(input);
      enableInteractiveControl(label);
      if (selected.has(option.id)) {
        input.setAttribute('checked', 'true');
        (input).checked = true;
      }
      label.createSpan({ text: option.label });
      input.addEventListener('change', () => {
        collect?.toggleMultiAnswer(
          question.id,
          option.id,
          (input).checked,
        );
        collect?.scheduleFlush();
      });
    }
    return;
  }

  // text / markdown
  const isMultiline = question.type === 'markdown';
  const field = isMultiline
    ? item.createEl('textarea', { cls: 'dean-session-section-question-input' })
    : item.createEl('input', {
      cls: 'dean-session-section-question-input',
      attr: { type: 'text' },
    });
  if (isMultiline) {
    field.setAttribute('rows', '4');
  }
  enableInteractiveControl(field);
  const textValue = typeof current === 'string' ? current : '';
  (field).value = textValue;
  field.addEventListener('input', () => {
    collect?.setAnswer(
      question.id,
      (field).value,
    );
  });
  field.addEventListener('blur', () => {
    void collect?.flush();
  });
}

/**
 * Keep CodeMirror Live Preview from swallowing pointer/keyboard events on
 * interactive controls inside a custom code-block embed.
 *
 * Must use bubble phase (not capture). Capture-phase stopPropagation on the
 * widget root runs before the target and blocks child click/change handlers
 * (Act buttons never fire). Bubble stop still prevents CM ancestors from
 * entering source edit after our controls handle the event.
 */
export function enableInteractiveEmbed(el: HTMLElement): void {
  el.setAttribute('contenteditable', 'false');
  el.addClass('dean-session-section--interactive');
  for (const type of ['mousedown', 'pointerdown', 'touchstart', 'click'] as const) {
    el.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
}

export function enableInteractiveControl(el: HTMLElement): void {
  el.setAttribute('contenteditable', 'false');
  for (const type of ['mousedown', 'pointerdown', 'touchstart', 'click'] as const) {
    el.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
  // Focus controls on mousedown; CM otherwise steals focus.
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') {
    el.addEventListener('mousedown', () => {
      window.setTimeout(() => {
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
      }, 0);
    });
  }
}

export function renderInvalidSessionSection(
  containerEl: HTMLElement,
  message: string,
): void {
  containerEl.empty();
  containerEl.addClass('dean-session-section');
  containerEl.addClass('dean-session-section--invalid');
  containerEl.createDiv({
    cls: 'dean-session-section-invalid-title',
    text: t('settings.sessionSections.invalid.title'),
  });
  containerEl.createDiv({
    cls: 'dean-session-section-invalid-message',
    text: message,
  });
}
