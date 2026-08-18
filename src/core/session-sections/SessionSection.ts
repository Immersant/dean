export const SESSION_SECTION_SCHEMA_VERSION = 1 as const;
export const SESSION_SECTION_FENCE_LANGUAGE = 'dean-session' as const;

export const SESSION_SECTION_LIMITS = {
  fenceBodyBytes: 64 * 1024,
  titleChars: 120,
  actionsPerSection: 8,
  questionsPerSection: 20,
  optionsPerQuestion: 12,
  labelChars: 80,
  promptChars: 8_000,
  answerChars: 8_000,
  sectionsPerNote: 16,
} as const;

export const SESSION_SECTION_LOCAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export const SESSION_SECTION_FORBIDDEN_KEYS = [
  'onClick',
  'shell',
  'command',
  'href',
] as const;

export type SessionSectionKind = 'act' | 'collect';
export type SessionSectionStatus = 'open' | 'stale';
export type SessionSectionQuestionType = 'single' | 'multi' | 'text' | 'markdown';

export interface SessionSectionAction {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
}

export interface SessionSectionQuestionOption {
  readonly id: string;
  readonly label: string;
}

export interface SessionSectionQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly type: SessionSectionQuestionType;
  readonly options?: readonly SessionSectionQuestionOption[];
}

export type SessionSectionAnswers = Record<string, string | string[]>;

export interface SessionSection {
  readonly schemaVersion: typeof SESSION_SECTION_SCHEMA_VERSION;
  readonly id: string;
  readonly conversationId: string;
  readonly epoch: number;
  readonly kind: SessionSectionKind;
  readonly title: string;
  readonly status: SessionSectionStatus;
  readonly createdAt: number;
  readonly actions: readonly SessionSectionAction[];
  readonly questions: readonly SessionSectionQuestion[];
  readonly answers: SessionSectionAnswers;
}
