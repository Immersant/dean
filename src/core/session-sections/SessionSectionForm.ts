import { isBoundSessionSection, isStandaloneCollectSessionSection } from './SessionSection';
import {
  SESSION_SECTION_LIMITS,
  type SessionSection,
  type SessionSectionAnswers,
  type SessionSectionQuestion,
} from './SessionSection';

export type SessionSectionFormMode = 'bound' | 'standalone';

export type SessionSectionFormErrorCode =
  | 'form-missing'
  | 'mixed-mode'
  | 'conversation-mismatch'
  | 'epoch-mismatch'
  | 'duplicate-question'
  | 'answer-conflict'
  | 'too-many-members'
  | 'too-many-questions'
  | 'invalid-member';

export interface SessionSectionFormError {
  readonly ok: false;
  readonly code: SessionSectionFormErrorCode;
  readonly message: string;
}

export interface ResolvedSessionSectionForm {
  readonly ok: true;
  readonly formId: string;
  readonly mode: SessionSectionFormMode;
  readonly title: string;
  readonly members: readonly SessionSection[];
  readonly memberSectionIds: readonly string[];
  readonly questions: readonly SessionSectionQuestion[];
  readonly answers: SessionSectionAnswers;
  readonly conversationId?: string;
  readonly epoch?: number;
}

export type SessionSectionFormResolveResult =
  | ResolvedSessionSectionForm
  | SessionSectionFormError;

export interface SessionSectionFormCandidate {
  readonly section?: SessionSection;
  readonly formId?: string;
  readonly parseError?: string;
}

export type SessionSectionFormInput = SessionSection | SessionSectionFormCandidate;

/**
 * Resolve one formId from document-ordered note candidates.
 * Group rules run here, not at single-fence parse time.
 */
export function resolveSessionSectionForm(
  inputs: readonly SessionSectionFormInput[],
  formId: string,
): SessionSectionFormResolveResult {
  const members: SessionSection[] = [];
  for (const input of inputs) {
    const candidate = asCandidate(input);
    const candidateFormId = candidate.section?.formId ?? candidate.formId;
    if (candidateFormId !== formId) {
      continue;
    }
    if (candidate.parseError || !candidate.section) {
      return error(
        'invalid-member',
        `Form "${formId}" has a member that failed to parse`,
      );
    }
    members.push(candidate.section);
  }

  if (members.length === 0) {
    return error('form-missing', `Form "${formId}" has no members in this note`);
  }
  if (members.length > SESSION_SECTION_LIMITS.membersPerForm) {
    return error(
      'too-many-members',
      `Form "${formId}" exceeds ${SESSION_SECTION_LIMITS.membersPerForm} members`,
    );
  }

  const mode = formMode(members[0]);
  for (const member of members) {
    if (formMode(member) !== mode) {
      return error('mixed-mode', `Form "${formId}" mixes bound and standalone members`);
    }
  }

  if (mode === 'bound') {
    const first = members[0];
    if (!isBoundSessionSection(first)) {
      return error('mixed-mode', `Form "${formId}" mixes bound and standalone members`);
    }
    for (const member of members) {
      if (!isBoundSessionSection(member)) {
        return error('mixed-mode', `Form "${formId}" mixes bound and standalone members`);
      }
      if (member.conversationId !== first.conversationId) {
        return error(
          'conversation-mismatch',
          `Form "${formId}" members must share conversationId`,
        );
      }
      if (member.epoch !== first.epoch) {
        return error('epoch-mismatch', `Form "${formId}" members must share epoch`);
      }
    }
  }

  const questions: SessionSectionQuestion[] = [];
  const questionIds = new Set<string>();
  for (const member of members) {
    for (const question of member.questions) {
      if (questionIds.has(question.id)) {
        return error(
          'duplicate-question',
          `Form "${formId}" has duplicate question id "${question.id}"`,
        );
      }
      questionIds.add(question.id);
      questions.push(question);
    }
  }
  if (questions.length > SESSION_SECTION_LIMITS.questionsPerForm) {
    return error(
      'too-many-questions',
      `Form "${formId}" exceeds ${SESSION_SECTION_LIMITS.questionsPerForm} questions`,
    );
  }

  const answers: SessionSectionAnswers = {};
  for (const member of members) {
    for (const [key, value] of Object.entries(member.answers)) {
      if (Object.prototype.hasOwnProperty.call(answers, key)) {
        return error(
          'answer-conflict',
          `Form "${formId}" has conflicting answers for "${key}"`,
        );
      }
      answers[key] = Array.isArray(value) ? [...value] : value;
    }
  }

  const first = members[0];
  return {
    ok: true,
    formId,
    mode,
    title: first.title,
    members,
    memberSectionIds: members.map(member => member.id),
    questions,
    answers,
    ...(mode === 'bound' && isBoundSessionSection(first)
      ? { conversationId: first.conversationId, epoch: first.epoch }
      : {}),
  };
}

/**
 * Submit controls belong on the last document-order member of a formId group.
 * Fences without formId keep their own submit.
 */
export function isLastSessionSectionFormMember(
  section: Pick<SessionSection, 'id' | 'formId'>,
  inputs: readonly SessionSectionFormInput[],
): boolean {
  if (!section.formId) {
    return true;
  }
  let lastId: string | undefined;
  for (const input of inputs) {
    const candidate = asCandidate(input);
    const candidateFormId = candidate.section?.formId ?? candidate.formId;
    if (candidateFormId !== section.formId || !candidate.section) {
      continue;
    }
    lastId = candidate.section.id;
  }
  return lastId === section.id;
}

function asCandidate(input: SessionSectionFormInput): SessionSectionFormCandidate {
  if ('schemaVersion' in input && 'kind' in input && 'id' in input) {
    return { section: input };
  }
  return input;
}

function formMode(section: SessionSection): SessionSectionFormMode {
  return isStandaloneCollectSessionSection(section) ? 'standalone' : 'bound';
}

function error(
  code: SessionSectionFormErrorCode,
  message: string,
): SessionSectionFormError {
  return { ok: false, code, message };
}
