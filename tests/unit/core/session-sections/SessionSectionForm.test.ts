import {
  type BoundActSessionSection,
  type BoundCollectSessionSection,
  SESSION_SECTION_LIMITS,
  type SessionSection,
  type StandaloneCollectSessionSection,
} from '@/core/session-sections/SessionSection';
import {
  isLastSessionSectionFormMember,
  resolveSessionSectionForm,
} from '@/core/session-sections/SessionSectionForm';

const FORM_ID = 'form_feedback';

function boundCollect(
  overrides: Partial<BoundCollectSessionSection> & Pick<BoundCollectSessionSection, 'id'>,
): BoundCollectSessionSection {
  return {
    schemaVersion: 1,
    conversationId: 'conv-1',
    epoch: 2,
    kind: 'collect',
    title: overrides.title ?? overrides.id,
    status: 'open',
    createdAt: 1710000100000,
    actions: [],
    questions: overrides.questions ?? [
      { id: `${overrides.id}_q`, prompt: 'Question', type: 'text' },
    ],
    answers: overrides.answers ?? {},
    formId: FORM_ID,
    ...overrides,
  };
}

function boundAct(
  overrides: Partial<BoundActSessionSection> & Pick<BoundActSessionSection, 'id'>,
): BoundActSessionSection {
  return {
    schemaVersion: 1,
    conversationId: 'conv-1',
    epoch: 2,
    kind: 'act',
    title: overrides.title ?? overrides.id,
    status: 'open',
    createdAt: 1710000100000,
    actions: [
      { id: 'done', label: "I'm done", prompt: 'Continue from the merged answers.' },
    ],
    questions: [],
    answers: {},
    formId: FORM_ID,
    ...overrides,
  };
}

function standaloneCollect(
  overrides: Partial<StandaloneCollectSessionSection> & Pick<StandaloneCollectSessionSection, 'id'>,
): StandaloneCollectSessionSection {
  return {
    schemaVersion: 1,
    kind: 'collect',
    title: overrides.title ?? overrides.id,
    status: 'open',
    createdAt: 1710000100000,
    startNewChat: 'Start new chat',
    actions: [],
    questions: overrides.questions ?? [
      { id: `${overrides.id}_q`, prompt: 'Question', type: 'text' },
    ],
    answers: overrides.answers ?? {},
    formId: FORM_ID,
    ...overrides,
  };
}

describe('resolveSessionSectionForm', () => {
  it('merges bound members in document order and keeps the first title', () => {
    const nav = boundCollect({
      id: 'sec_nav',
      title: 'Navigation',
      questions: [{ id: 'approach', prompt: 'Which nav?', type: 'text' }],
      answers: { approach: 'tabs' },
    });
    const notes = boundCollect({
      id: 'sec_notes',
      title: 'Notes',
      questions: [{ id: 'notes', prompt: 'Comments', type: 'markdown' }],
      answers: { notes: 'Keep it small.' },
    });
    const submit = boundAct({ id: 'sec_done' });

    const result = resolveSessionSectionForm([nav, notes, submit], FORM_ID);
    expect(result).toMatchObject({
      ok: true,
      formId: FORM_ID,
      mode: 'bound',
      title: 'Navigation',
      conversationId: 'conv-1',
      epoch: 2,
      memberSectionIds: ['sec_nav', 'sec_notes', 'sec_done'],
      answers: { approach: 'tabs', notes: 'Keep it small.' },
    });
    if (!result.ok) {
      throw new Error('expected resolved form');
    }
    expect(result.questions.map(question => question.id)).toEqual(['approach', 'notes']);
  });

  it('accepts a one-member form', () => {
    const only = standaloneCollect({
      id: 'sec_only',
      title: 'Intake',
      questions: [{ id: 'goal', prompt: 'Goal?', type: 'text' }],
      answers: { goal: 'Ship it' },
    });
    expect(resolveSessionSectionForm([only], FORM_ID)).toMatchObject({
      ok: true,
      mode: 'standalone',
      title: 'Intake',
      memberSectionIds: ['sec_only'],
      answers: { goal: 'Ship it' },
    });
  });

  it('ignores fences with a different or missing formId', () => {
    const member = boundCollect({
      id: 'sec_a',
      questions: [{ id: 'a', prompt: 'A', type: 'text' }],
      answers: { a: '1' },
    });
    const otherForm = boundCollect({
      id: 'sec_b',
      formId: 'form_other',
      questions: [{ id: 'b', prompt: 'B', type: 'text' }],
      answers: { b: '2' },
    });
    const ungrouped = boundCollect({
      id: 'sec_c',
      formId: undefined,
      questions: [{ id: 'c', prompt: 'C', type: 'text' }],
      answers: { c: '3' },
    });

    const result = resolveSessionSectionForm([member, otherForm, ungrouped], FORM_ID);
    expect(result).toMatchObject({
      ok: true,
      memberSectionIds: ['sec_a'],
      answers: { a: '1' },
    });
  });

  it('fails closed on duplicate question ids', () => {
    const first = boundCollect({
      id: 'sec_a',
      questions: [{ id: 'shared', prompt: 'First', type: 'text' }],
      answers: { shared: 'one' },
    });
    const second = boundCollect({
      id: 'sec_b',
      questions: [{ id: 'shared', prompt: 'Second', type: 'text' }],
      answers: { shared: 'one' },
    });
    expect(resolveSessionSectionForm([first, second], FORM_ID)).toMatchObject({
      ok: false,
      code: 'duplicate-question',
    });
  });

  it('fails closed on answer-key conflicts without duplicate questions', () => {
    const first = boundCollect({
      id: 'sec_a',
      questions: [{ id: 'a', prompt: 'A', type: 'text' }],
      answers: { a: '1', leftover: 'x' },
    });
    const second = boundCollect({
      id: 'sec_b',
      questions: [{ id: 'b', prompt: 'B', type: 'text' }],
      answers: { b: '2', leftover: 'y' },
    });
    expect(resolveSessionSectionForm([first, second], FORM_ID)).toMatchObject({
      ok: false,
      code: 'answer-conflict',
    });
  });

  it('fails closed when bound and standalone members share a formId', () => {
    const bound = boundCollect({ id: 'sec_bound' });
    const standalone = standaloneCollect({ id: 'sec_solo' });
    expect(resolveSessionSectionForm([bound, standalone], FORM_ID)).toMatchObject({
      ok: false,
      code: 'mixed-mode',
    });
  });

  it('fails closed on conversation or epoch mismatch', () => {
    const first = boundCollect({ id: 'sec_a' });
    const conversation = boundCollect({ id: 'sec_b', conversationId: 'conv-other' });
    const epoch = boundCollect({ id: 'sec_c', epoch: 9 });
    expect(resolveSessionSectionForm([first, conversation], FORM_ID)).toMatchObject({
      ok: false,
      code: 'conversation-mismatch',
    });
    expect(resolveSessionSectionForm([first, epoch], FORM_ID)).toMatchObject({
      ok: false,
      code: 'epoch-mismatch',
    });
  });

  it('fails closed when a sibling with the same formId did not parse', () => {
    const member = boundCollect({ id: 'sec_a' });
    expect(resolveSessionSectionForm(
      [
        { section: member },
        { formId: FORM_ID, parseError: 'invalid YAML' },
      ],
      FORM_ID,
    )).toMatchObject({
      ok: false,
      code: 'invalid-member',
    });
  });

  it('fails closed when the form exceeds member or question caps', () => {
    const tooManyMembers: SessionSection[] = Array.from(
      { length: SESSION_SECTION_LIMITS.membersPerForm + 1 },
      (_, index) => boundCollect({
        id: `sec_${index}`,
        questions: [{ id: `q_${index}`, prompt: 'Q', type: 'text' }],
      }),
    );
    expect(resolveSessionSectionForm(tooManyMembers, FORM_ID)).toMatchObject({
      ok: false,
      code: 'too-many-members',
    });

    const tooManyQuestions = [
      boundCollect({
        id: 'sec_a',
        questions: Array.from(
          { length: SESSION_SECTION_LIMITS.questionsPerSection },
          (_, index) => ({ id: `a_${index}`, prompt: 'Q', type: 'text' as const }),
        ),
      }),
      boundCollect({
        id: 'sec_b',
        questions: Array.from(
          { length: SESSION_SECTION_LIMITS.questionsPerForm
            - SESSION_SECTION_LIMITS.questionsPerSection + 1 },
          (_, index) => ({ id: `b_${index}`, prompt: 'Q', type: 'text' as const }),
        ),
      }),
    ];
    expect(resolveSessionSectionForm(tooManyQuestions, FORM_ID)).toMatchObject({
      ok: false,
      code: 'too-many-questions',
    });
  });

  it('treats only the last formId member as the submit surface', () => {
    const first = standaloneCollect({ id: 'sec_a' });
    const last = standaloneCollect({ id: 'sec_b' });
    const other = standaloneCollect({ id: 'sec_other', formId: 'form_other' });
    expect(isLastSessionSectionFormMember(first, [first, last, other])).toBe(false);
    expect(isLastSessionSectionFormMember(last, [first, last, other])).toBe(true);
    expect(isLastSessionSectionFormMember(
      standaloneCollect({ id: 'ungrouped', formId: undefined }),
      [first, last],
    )).toBe(true);
  });

  it('returns form-missing when no member matches', () => {
    expect(resolveSessionSectionForm(
      [boundCollect({ id: 'sec_a', formId: 'form_other' })],
      FORM_ID,
    )).toMatchObject({
      ok: false,
      code: 'form-missing',
    });
  });
});
