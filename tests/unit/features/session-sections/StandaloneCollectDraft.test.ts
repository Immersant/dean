import type { StandaloneCollectSessionSection } from '@/core/session-sections';
import { formatStandaloneCollectDraft } from '@/features/session-sections/StandaloneCollectDraft';

const section: StandaloneCollectSessionSection = {
  schemaVersion: 1,
  id: 'discovery',
  kind: 'collect',
  title: 'Discovery #1',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: true,
  actions: [],
  questions: [
    { id: 'goal', prompt: 'What should we build?', type: 'markdown' },
    {
      id: 'areas',
      prompt: 'Which areas matter?',
      type: 'multi',
      options: [
        { id: 'a11y', label: 'Accessibility' },
        { id: 'storage', label: 'Persistence' },
      ],
    },
    { id: 'empty', prompt: 'Anything else?', type: 'text' },
  ],
  answers: {
    goal: 'A reviewable workflow.',
    areas: ['a11y', 'storage'],
    empty: '',
  },
};

describe('formatStandaloneCollectDraft', () => {
  it('formats standalone answers as editable Markdown', () => {
    expect(formatStandaloneCollectDraft(section, 'Notes/Discovery.md')).toBe([
      '# Discovery \\#1',
      '',
      'Source note: Notes/Discovery.md',
      '',
      '## What should we build?',
      '',
      'A reviewable workflow.',
      '',
      '## Which areas matter?',
      '',
      '- Accessibility',
      '- Persistence',
      '',
      '## Anything else?',
      '',
      '_Not answered_',
    ].join('\n'));
  });

  it('collapses heading newlines and preserves unknown option ids', () => {
    const changed = {
      ...section,
      title: 'Discovery\nquestions',
      answers: { ...section.answers, areas: ['missing-option'] },
    };
    const draft = formatStandaloneCollectDraft(changed, 'Notes/Discovery.md');
    expect(draft).toContain('# Discovery questions');
    expect(draft).toContain('- missing-option');
  });
});
