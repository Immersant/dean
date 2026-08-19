import {
  serializeSessionSectionYaml,
  SESSION_SECTION_FENCE_LANGUAGE,
  validateSessionSection,
} from '@/core/session-sections';
import { shouldRenderSessionSectionSubmit } from '@/features/session-sections/shouldRenderSessionSectionSubmit';

const first = validateSessionSection({
  schemaVersion: 1,
  id: 'sec_first',
  formId: 'form_split',
  kind: 'collect',
  title: 'Intent',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: 'Start new chat',
  questions: [{ id: 'goal', prompt: 'Goal?', type: 'text' }],
  answers: {},
});

const last = validateSessionSection({
  schemaVersion: 1,
  id: 'sec_last',
  formId: 'form_split',
  kind: 'collect',
  title: 'Wrap-up',
  status: 'open',
  createdAt: 1710000100001,
  startNewChat: 'Start new chat',
  questions: [{ id: 'done', prompt: 'Done?', type: 'text' }],
  answers: {},
});

const note = [
  '```' + SESSION_SECTION_FENCE_LANGUAGE,
  serializeSessionSectionYaml(first).trimEnd(),
  '```',
  '',
  '```' + SESSION_SECTION_FENCE_LANGUAGE,
  serializeSessionSectionYaml(last).trimEnd(),
  '```',
].join('\n');

describe('shouldRenderSessionSectionSubmit', () => {
  it('keeps submit on ungrouped fences', () => {
    const ungrouped = validateSessionSection({
      schemaVersion: 1,
      id: 'ungrouped',
      kind: 'collect',
      title: 'Discovery',
      status: 'open',
      createdAt: 1710000100000,
      startNewChat: 'Start new chat',
      questions: [{ id: 'goal', prompt: 'Goal?', type: 'text' }],
      answers: {},
    });
    expect(shouldRenderSessionSectionSubmit(ungrouped, note)).toBe(true);
  });

  it('keeps submit only on the last formId member', () => {
    expect(shouldRenderSessionSectionSubmit(first, note)).toBe(false);
    expect(shouldRenderSessionSectionSubmit(last, note)).toBe(true);
  });
});
