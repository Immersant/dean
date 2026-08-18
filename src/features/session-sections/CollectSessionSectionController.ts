import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { MarkdownRenderChild } from 'obsidian';

import type {
  CollectSessionSection,
  SessionSectionAnswers,
  SessionSectionQuestion,
} from '../../core/session-sections';
import {
  computeAnswersDigest,
  writeSessionSectionToNote,
} from './SessionSectionWriteBack';

export interface CollectSessionSectionControllerOptions {
  readonly app: App;
  readonly el: HTMLElement;
  readonly ctx: MarkdownPostProcessorContext;
  readonly notePath: string;
  readonly section: CollectSessionSection;
  readonly originalSource: string;
  readonly onAnswersChange?: (answers: SessionSectionAnswers) => void;
}

/**
 * Owns Collect answer state and flushes to the note on blur / destroy.
 * Never sends a chat turn.
 */
export class CollectSessionSectionController extends MarkdownRenderChild {
  private readonly app: App;
  private readonly ctx: MarkdownPostProcessorContext;
  private readonly notePath: string;
  private readonly baseSection: CollectSessionSection;
  private readonly originalSource: string;
  private readonly onAnswersChange?: (answers: SessionSectionAnswers) => void;
  private answers: SessionSectionAnswers;
  private lastWrittenDigest: string | null;
  private flushTail: Promise<void> = Promise.resolve();
  private disposed = false;
  private flushTimer: number | null = null;

  constructor(options: CollectSessionSectionControllerOptions) {
    super(options.el);
    this.app = options.app;
    this.ctx = options.ctx;
    this.notePath = options.notePath;
    this.baseSection = options.section;
    this.originalSource = options.originalSource;
    this.onAnswersChange = options.onAnswersChange;
    this.answers = cloneAnswers(options.section.answers);
    this.lastWrittenDigest = computeAnswersDigest(
      options.notePath,
      options.section.id,
      this.answers,
    );
  }

  getAnswers(): SessionSectionAnswers {
    return cloneAnswers(this.answers);
  }

  getSectionWithAnswers(): CollectSessionSection {
    return {
      ...this.baseSection,
      answers: cloneAnswers(this.answers),
    };
  }

  setAnswer(questionId: string, value: string | string[]): void {
    if (this.disposed) {
      return;
    }
    if (Array.isArray(value)) {
      this.answers = {
        ...this.answers,
        [questionId]: [...value],
      };
    } else {
      this.answers = {
        ...this.answers,
        [questionId]: value,
      };
    }
    this.onAnswersChange?.(this.getAnswers());
  }

  setSingleAnswer(questionId: string, optionId: string): void {
    this.setAnswer(questionId, optionId);
  }

  toggleMultiAnswer(questionId: string, optionId: string, selected: boolean): void {
    const current = this.answers[questionId];
    const set = new Set(Array.isArray(current) ? current : current ? [current] : []);
    if (selected) {
      set.add(optionId);
    } else {
      set.delete(optionId);
    }
    this.setAnswer(questionId, [...set]);
  }

  /**
   * Debounced flush for radio/checkbox changes.
   * Immediate vault.modify remounts the processor and can cancel the browser's
   * just-applied checked state if it races the paint.
   */
  scheduleFlush(delayMs = 200): void {
    if (this.disposed) {
      return;
    }
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delayMs);
  }

  /** Flush answers to the vault. Safe to call often; skips unchanged content. */
  flush(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    return this.enqueueFlush();
  }

  onunload(): void {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // Capture answers before dispose; still allow the in-flight write.
    void this.enqueueFlush();
    this.disposed = true;
  }

  private enqueueFlush(): Promise<void> {
    const section = this.getSectionWithAnswers();
    const digest = computeAnswersDigest(this.notePath, section.id, section.answers);
    if (digest === this.lastWrittenDigest) {
      return this.flushTail;
    }

    const answersSnapshot = this.getAnswers();
    this.flushTail = this.flushTail
      .catch(() => undefined)
      .then(async () => {
        const latestDigest = computeAnswersDigest(
          this.notePath,
          section.id,
          answersSnapshot,
        );
        if (latestDigest === this.lastWrittenDigest) {
          return;
        }
        const result = await writeSessionSectionToNote({
          app: this.app,
          notePath: this.notePath,
          el: this.containerEl,
          ctx: this.ctx,
          section: {
            ...this.baseSection,
            answers: answersSnapshot,
          },
          originalSource: this.originalSource,
        });
        if (result.status === 'written' || result.status === 'skipped') {
          this.lastWrittenDigest = latestDigest;
        }
      });
    return this.flushTail;
  }
}

export function isSelectableQuestion(question: SessionSectionQuestion): boolean {
  return question.type === 'single' || question.type === 'multi';
}

function cloneAnswers(answers: SessionSectionAnswers): SessionSectionAnswers {
  const next: SessionSectionAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    next[key] = Array.isArray(value) ? [...value] : value;
  }
  return next;
}
