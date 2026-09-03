import { SESSION_SECTION_FENCE_LANGUAGE } from '@/core/session-sections';
import { listNoteSessionSections } from '@/features/session-sections/listNoteSessionSections';

const COLLECT = `
schemaVersion: 1
id: sec_nav
formId: form_feedback
conversationId: conv-1
epoch: 0
kind: collect
title: Navigation
status: open
createdAt: 1710000100000
questions:
  - id: approach
    prompt: Which model?
    type: text
answers:
  approach: tabs
`.trim();

const STANDALONE = `
schemaVersion: 1
id: sec_notes
formId: form_feedback
kind: collect
title: Notes
status: open
createdAt: 1710000100000
startNewChat: Start new chat
questions:
  - id: notes
    prompt: Comments
    type: markdown
answers:
  notes: Keep it small.
`.trim();

function fence(body: string): string {
  return '```' + SESSION_SECTION_FENCE_LANGUAGE + '\n' + body + '\n```';
}

describe('listNoteSessionSections', () => {
  it('lists two fences with prose between them in document order', () => {
    const note = [
      '# Intro',
      '',
      fence(COLLECT),
      '',
      'User markup lives here.',
      '',
      fence(STANDALONE),
    ].join('\n');

    const listed = listNoteSessionSections(note);
    expect(listed).toHaveLength(2);
    expect(listed[0].section?.id).toBe('sec_nav');
    expect(listed[0].formId).toBe('form_feedback');
    expect(listed[1].section?.id).toBe('sec_notes');
    expect(listed[0].range.end).toBeLessThanOrEqual(listed[1].range.start);
    expect(note.slice(listed[0].range.end, listed[1].range.start)).toContain('User markup');
  });

  it('keeps an invalid sibling as a parse error and peeks formId', () => {
    const invalid = 'formId: form_feedback\nkind: collect\nthis: [';
    const note = [fence(COLLECT), '', fence(invalid)].join('\n');
    const listed = listNoteSessionSections(note);
    expect(listed).toHaveLength(2);
    expect(listed[0].section?.id).toBe('sec_nav');
    expect(listed[1].section).toBeUndefined();
    expect(listed[1].parseError).toBeTruthy();
    expect(listed[1].formId).toBe('form_feedback');
  });

  it('maps CRLF notes to original offsets', () => {
    const note = ['# Intro', '', fence(COLLECT)].join('\r\n');
    const listed = listNoteSessionSections(note);
    expect(listed).toHaveLength(1);
    expect(note.slice(listed[0].range.start, listed[0].range.end)).toContain('sec_nav');
    expect(listed[0].section?.id).toBe('sec_nav');
  });
});
