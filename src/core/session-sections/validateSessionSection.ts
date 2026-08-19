import { isValidSessionMetadataId } from '../bootstrap/SessionStorage';
import { decodeSectionEpoch } from './decodeSectionEpoch';
import {
  type BoundSessionSection,
  SESSION_SECTION_FORBIDDEN_KEYS,
  SESSION_SECTION_LIMITS,
  SESSION_SECTION_LOCAL_ID_PATTERN,
  SESSION_SECTION_SCHEMA_VERSION,
  type SessionSection,
  type SessionSectionAction,
  type SessionSectionAnswers,
  type SessionSectionKind,
  type SessionSectionQuestion,
  type SessionSectionQuestionOption,
  type SessionSectionQuestionType,
  type SessionSectionStatus,
} from './SessionSection';
import { parseSessionSectionPresentation } from './SessionSectionPresentation';
import { SessionSectionValidationError } from './SessionSectionValidationError';

export { SessionSectionValidationError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertNoForbiddenKeys(record: Record<string, unknown>, path: string): void {
  for (const key of SESSION_SECTION_FORBIDDEN_KEYS) {
    if (key in record) {
      throw new SessionSectionValidationError(
        `${path} must not include execution-like field "${key}"`,
      );
    }
  }
}

function requireLocalId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SESSION_SECTION_LOCAL_ID_PATTERN.test(value)) {
    throw new SessionSectionValidationError(`${field} must be a local id (1-64 safe characters)`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, field: string, maxChars: number): string {
  if (typeof value !== 'string') {
    throw new SessionSectionValidationError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new SessionSectionValidationError(`${field} must be non-empty`);
  }
  if (trimmed.length > maxChars) {
    throw new SessionSectionValidationError(`${field} exceeds ${maxChars} characters`);
  }
  return trimmed;
}

function parseKind(value: unknown): SessionSectionKind {
  if (value === 'act' || value === 'collect') {
    return value;
  }
  throw new SessionSectionValidationError('kind must be "act" or "collect"');
}

function parseStatus(value: unknown): SessionSectionStatus {
  if (value === undefined || value === null) {
    return 'open';
  }
  if (value === 'open' || value === 'stale') {
    return value;
  }
  throw new SessionSectionValidationError('status must be "open" or "stale"');
}

function parseCreatedAt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new SessionSectionValidationError('createdAt must be a non-negative integer timestamp');
  }
  return value;
}

function parseAction(value: unknown, index: number): SessionSectionAction {
  if (!isRecord(value)) {
    throw new SessionSectionValidationError(`actions[${index}] must be a mapping`);
  }
  assertNoForbiddenKeys(value, `actions[${index}]`);
  return {
    id: requireLocalId(value.id, `actions[${index}].id`),
    label: requireNonEmptyString(value.label, `actions[${index}].label`, SESSION_SECTION_LIMITS.labelChars),
    prompt: requireNonEmptyString(
      value.prompt,
      `actions[${index}].prompt`,
      SESSION_SECTION_LIMITS.promptChars,
    ),
    ...parseSessionSectionPresentation(value, `actions[${index}]`),
  };
}

function parseOption(value: unknown, questionIndex: number, optionIndex: number): SessionSectionQuestionOption {
  if (!isRecord(value)) {
    throw new SessionSectionValidationError(
      `questions[${questionIndex}].options[${optionIndex}] must be a mapping`,
    );
  }
  assertNoForbiddenKeys(value, `questions[${questionIndex}].options[${optionIndex}]`);
  return {
    id: requireLocalId(value.id, `questions[${questionIndex}].options[${optionIndex}].id`),
    label: requireNonEmptyString(
      value.label,
      `questions[${questionIndex}].options[${optionIndex}].label`,
      SESSION_SECTION_LIMITS.labelChars,
    ),
    ...parseSessionSectionPresentation(
      value,
      `questions[${questionIndex}].options[${optionIndex}]`,
    ),
  };
}

function parseQuestionType(value: unknown, index: number): SessionSectionQuestionType {
  if (value === 'single' || value === 'multi' || value === 'text' || value === 'markdown') {
    return value;
  }
  throw new SessionSectionValidationError(
    `questions[${index}].type must be single, multi, text, or markdown`,
  );
}

function parseQuestion(value: unknown, index: number): SessionSectionQuestion {
  if (!isRecord(value)) {
    throw new SessionSectionValidationError(`questions[${index}] must be a mapping`);
  }
  assertNoForbiddenKeys(value, `questions[${index}]`);
  const type = parseQuestionType(value.type, index);
  const question: SessionSectionQuestion = {
    id: requireLocalId(value.id, `questions[${index}].id`),
    prompt: requireNonEmptyString(
      value.prompt,
      `questions[${index}].prompt`,
      SESSION_SECTION_LIMITS.promptChars,
    ),
    type,
    ...parseSessionSectionPresentation(value, `questions[${index}]`),
  };

  if (type === 'single' || type === 'multi') {
    if (!Array.isArray(value.options) || value.options.length === 0) {
      throw new SessionSectionValidationError(
        `questions[${index}].options is required for type ${type}`,
      );
    }
    if (value.options.length > SESSION_SECTION_LIMITS.optionsPerQuestion) {
      throw new SessionSectionValidationError(
        `questions[${index}].options exceeds ${SESSION_SECTION_LIMITS.optionsPerQuestion} options`,
      );
    }
    return {
      ...question,
      options: value.options.map((option, optionIndex) => parseOption(option, index, optionIndex)),
    };
  }

  if (value.options !== undefined) {
    throw new SessionSectionValidationError(
      `questions[${index}].options is only allowed for single/multi types`,
    );
  }
  return question;
}

function parseFormId(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireLocalId(value, 'formId');
}

function parseAnswers(value: unknown): SessionSectionAnswers {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new SessionSectionValidationError('answers must be a mapping');
  }
  assertNoForbiddenKeys(value, 'answers');
  const answers: SessionSectionAnswers = {};
  for (const [key, answer] of Object.entries(value)) {
    requireLocalId(key, `answers key "${key}"`);
    if (typeof answer === 'string') {
      if (answer.length > SESSION_SECTION_LIMITS.answerChars) {
        throw new SessionSectionValidationError(
          `answers.${key} exceeds ${SESSION_SECTION_LIMITS.answerChars} characters`,
        );
      }
      answers[key] = answer;
      continue;
    }
    if (Array.isArray(answer) && answer.every(item => typeof item === 'string')) {
      for (const item of answer) {
        if (item.length > SESSION_SECTION_LIMITS.answerChars) {
          throw new SessionSectionValidationError(
            `answers.${key} exceeds ${SESSION_SECTION_LIMITS.answerChars} characters`,
          );
        }
      }
      answers[key] = answer;
      continue;
    }
    throw new SessionSectionValidationError(
      `answers.${key} must be a string or string array`,
    );
  }
  return answers;
}

/**
 * Fail-closed decode of a raw YAML mapping into a SessionSection.
 */
export function validateSessionSection(raw: unknown): SessionSection {
  if (!isRecord(raw)) {
    throw new SessionSectionValidationError('section must be a YAML mapping');
  }
  assertNoForbiddenKeys(raw, 'section');

  if (raw.schemaVersion !== SESSION_SECTION_SCHEMA_VERSION) {
    throw new SessionSectionValidationError(
      `schemaVersion must be ${SESSION_SECTION_SCHEMA_VERSION}`,
    );
  }

  const id = requireLocalId(raw.id, 'id');
  const formId = parseFormId(raw.formId);
  const kind = parseKind(raw.kind);
  const title = requireNonEmptyString(raw.title, 'title', SESSION_SECTION_LIMITS.titleChars);
  const status = parseStatus(raw.status);
  const createdAt = parseCreatedAt(raw.createdAt);
  const actionsRaw = raw.actions === undefined ? [] : raw.actions;
  if (!Array.isArray(actionsRaw)) {
    throw new SessionSectionValidationError('actions must be an array');
  }
  if (actionsRaw.length > SESSION_SECTION_LIMITS.actionsPerSection) {
    throw new SessionSectionValidationError(
      `actions exceeds ${SESSION_SECTION_LIMITS.actionsPerSection} items`,
    );
  }

  const questionsRaw = raw.questions === undefined ? [] : raw.questions;
  if (!Array.isArray(questionsRaw)) {
    throw new SessionSectionValidationError('questions must be an array');
  }
  if (questionsRaw.length > SESSION_SECTION_LIMITS.questionsPerSection) {
    throw new SessionSectionValidationError(
      `questions exceeds ${SESSION_SECTION_LIMITS.questionsPerSection} items`,
    );
  }

  if (kind === 'act' && actionsRaw.length === 0) {
    throw new SessionSectionValidationError('act sections require at least one action');
  }
  if (kind === 'collect' && questionsRaw.length === 0) {
    throw new SessionSectionValidationError('collect sections require at least one question');
  }

  const actions = actionsRaw.map((action, index) => parseAction(action, index));
  const questions = questionsRaw.map((question, index) => parseQuestion(question, index));
  const answers = parseAnswers(raw.answers);
  const actionIds = new Set<string>();
  for (const action of actions) {
    if (actionIds.has(action.id)) {
      throw new SessionSectionValidationError(`duplicate action id "${action.id}"`);
    }
    actionIds.add(action.id);
  }
  const questionIds = new Set<string>();
  for (const question of questions) {
    if (questionIds.has(question.id)) {
      throw new SessionSectionValidationError(`duplicate question id "${question.id}"`);
    }
    questionIds.add(question.id);
  }

  if (raw.startNewChat !== undefined) {
    if (kind !== 'collect') {
      throw new SessionSectionValidationError('startNewChat is only allowed for collect sections');
    }
    const startNewChat = requireNonEmptyString(
      raw.startNewChat,
      'startNewChat',
      SESSION_SECTION_LIMITS.labelChars,
    );
    if (raw.conversationId !== undefined || raw.epoch !== undefined) {
      throw new SessionSectionValidationError(
        'standalone collect sections must omit conversationId and epoch',
      );
    }
    if (raw.actions !== undefined) {
      throw new SessionSectionValidationError('standalone collect sections must omit actions');
    }
    return {
      schemaVersion: SESSION_SECTION_SCHEMA_VERSION,
      id,
      ...(formId ? { formId } : {}),
      kind: 'collect',
      title,
      status,
      createdAt,
      startNewChat,
      actions: [],
      questions,
      answers,
      ...parseSessionSectionPresentation(raw, 'section'),
    };
  }

  const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId : '';
  if (!isValidSessionMetadataId(conversationId)) {
    throw new SessionSectionValidationError('conversationId is not a valid session metadata id');
  }

  const section: BoundSessionSection = {
    schemaVersion: SESSION_SECTION_SCHEMA_VERSION,
    id,
    ...(formId ? { formId } : {}),
    conversationId,
    epoch: decodeSectionEpoch(raw.epoch),
    kind,
    title,
    status,
    createdAt,
    actions,
    questions,
    answers,
    ...parseSessionSectionPresentation(raw, 'section'),
  };
  return section;
}
