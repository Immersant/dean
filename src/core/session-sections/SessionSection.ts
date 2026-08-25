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
  membersPerForm: 8,
  questionsPerForm: 40,
  cssClassTokens: 8,
  cssClassTokenChars: 64,
  styleDecls: 32,
  styleValueChars: 200,
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
  /** Opens a fresh unsent chat draft instead of submitting to the bound conversation. */
  readonly startNewChat?: boolean;
  readonly cssClass?: string;
  readonly style?: Readonly<Record<string, string>>;
}

export interface SessionSectionQuestionOption {
  readonly id: string;
  readonly label: string;
  readonly cssClass?: string;
  readonly style?: Readonly<Record<string, string>>;
}

export interface SessionSectionQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly type: SessionSectionQuestionType;
  readonly options?: readonly SessionSectionQuestionOption[];
  readonly cssClass?: string;
  readonly style?: Readonly<Record<string, string>>;
}

export type SessionSectionAnswers = Record<string, string | string[]>;

interface SessionSectionBase {
  readonly schemaVersion: typeof SESSION_SECTION_SCHEMA_VERSION;
  readonly id: string;
  readonly formId?: string;
  readonly title: string;
  readonly status: SessionSectionStatus;
  readonly createdAt: number;
  readonly questions: readonly SessionSectionQuestion[];
  readonly answers: SessionSectionAnswers;
  readonly cssClass?: string;
  readonly style?: Readonly<Record<string, string>>;
}

export interface BoundActSessionSection extends SessionSectionBase {
  readonly kind: 'act';
  readonly conversationId: string;
  readonly epoch: number;
  readonly actions: readonly SessionSectionAction[];
  readonly startNewChat?: never;
}

export interface BoundCollectSessionSection extends SessionSectionBase {
  readonly kind: 'collect';
  readonly conversationId: string;
  readonly epoch: number;
  readonly actions: readonly SessionSectionAction[];
  readonly startNewChat?: never;
}

export interface StandaloneCollectSessionSection extends SessionSectionBase {
  readonly kind: 'collect';
  /** Authored submit-button label. Presence of this string marks the standalone variant. */
  readonly startNewChat: string;
  readonly actions: readonly [];
  readonly conversationId?: never;
  readonly epoch?: never;
}

export type BoundSessionSection = BoundActSessionSection | BoundCollectSessionSection;
export type CollectSessionSection = BoundCollectSessionSection | StandaloneCollectSessionSection;
export type SessionSection = BoundSessionSection | StandaloneCollectSessionSection;

export function isStandaloneCollectSessionSection(
  section: SessionSection,
): section is StandaloneCollectSessionSection {
  return section.kind === 'collect' && typeof section.startNewChat === 'string';
}

export function isBoundSessionSection(
  section: SessionSection,
): section is BoundSessionSection {
  return !isStandaloneCollectSessionSection(section);
}
