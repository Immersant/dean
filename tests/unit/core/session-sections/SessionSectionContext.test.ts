import { formatSessionSectionContext } from '@/core/session-sections/SessionSectionContext';
import type { ExecutionInputSessionSectionSnapshot } from '@/core/types';

const ACT_SECTION: ExecutionInputSessionSectionSnapshot = {
  sectionId: 'sec_review',
  notePath: 'Notes/Spec.md',
  conversationId: 'conv-1',
  kind: 'act',
  actionId: 'review',
  title: 'Follow-ups',
  prompt: 'Review this note carefully.',
};

function collectSection(
  overrides: Partial<ExecutionInputSessionSectionSnapshot> = {},
): ExecutionInputSessionSectionSnapshot {
  return {
    sectionId: 'sec_done',
    notePath: 'Notes/Spec.md',
    conversationId: 'conv-1',
    kind: 'collect',
    actionId: 'done',
    title: 'Notes',
    prompt: 'Continue from the merged answers.',
    ...overrides,
  };
}

describe('formatSessionSectionContext', () => {
  it('keeps prompt-only Act XML', () => {
    expect(formatSessionSectionContext(ACT_SECTION)).toBe(
      [
        '<session_section id="sec_review" kind="act" action="review" path="Notes/Spec.md" title="Follow-ups">',
        '<![CDATA[Review this note carefully.]]>',
        '</session_section>',
      ].join('\n'),
    );
  });

  it('inlines labeled Collect questions and answers after the prompt', () => {
    const xml = formatSessionSectionContext(collectSection({
      questions: [
        {
          id: 'approach',
          prompt: 'Which navigation model?',
          type: 'single',
          options: [
            { id: 'tabs', label: 'Tabs' },
            { id: 'sidebar', label: 'Sidebar' },
          ],
        },
        {
          id: 'notes',
          prompt: 'Comments',
          type: 'markdown',
        },
      ],
      answers: {
        approach: 'tabs',
        notes: 'Keep it small.',
      },
    }));

    expect(xml).toBe(
      [
        '<session_section id="sec_done" kind="collect" action="done" path="Notes/Spec.md" title="Notes">',
        '<![CDATA[Continue from the merged answers.]]>',
        '<question id="approach" type="single">',
        '<prompt><![CDATA[Which navigation model?]]></prompt>',
        '<answer id="tabs"><![CDATA[Tabs]]></answer>',
        '</question>',
        '<question id="notes" type="markdown">',
        '<prompt><![CDATA[Comments]]></prompt>',
        '<answer><![CDATA[Keep it small.]]></answer>',
        '</question>',
        '</session_section>',
      ].join('\n'),
    );
  });

  it('lists unanswered questions without an answer child', () => {
    const xml = formatSessionSectionContext(collectSection({
      questions: [
        { id: 'notes', prompt: 'Comments', type: 'text' },
        { id: 'areas', prompt: 'Areas', type: 'multi' },
      ],
      answers: {
        notes: '',
        areas: [],
      },
    }));

    expect(xml).toContain(
      [
        '<question id="notes" type="text">',
        '<prompt><![CDATA[Comments]]></prompt>',
        '</question>',
      ].join('\n'),
    );
    expect(xml).toContain(
      [
        '<question id="areas" type="multi">',
        '<prompt><![CDATA[Areas]]></prompt>',
        '</question>',
      ].join('\n'),
    );
    expect(xml).not.toContain('<answer');
  });

  it('emits one answer tag per multi-select value', () => {
    const xml = formatSessionSectionContext(collectSection({
      questions: [
        {
          id: 'features',
          prompt: 'Which features?',
          type: 'multi',
          options: [
            { id: 'a', label: 'Search' },
            { id: 'b', label: 'History' },
            { id: 'c', label: 'Pins' },
          ],
        },
      ],
      answers: { features: ['a', 'b'] },
    }));

    expect(xml).toContain('<answer id="a"><![CDATA[Search]]></answer>');
    expect(xml).toContain('<answer id="b"><![CDATA[History]]></answer>');
    expect(xml).not.toContain('Pins');
  });

  it('emits leftover answers that are not in questions', () => {
    const xml = formatSessionSectionContext(collectSection({
      questions: [{ id: 'notes', prompt: 'Comments', type: 'text' }],
      answers: { notes: 'Hello', leftover: 'x' },
    }));

    expect(xml).toContain(
      [
        '<question id="notes" type="text">',
        '<prompt><![CDATA[Comments]]></prompt>',
        '<answer><![CDATA[Hello]]></answer>',
        '</question>',
        '<answer id="leftover"><![CDATA[x]]></answer>',
      ].join('\n'),
    );
  });

  it('emits legacy answers when questions are missing', () => {
    const xml = formatSessionSectionContext(collectSection({
      answers: { notes: 'Only this fence' },
    }));

    expect(xml).toBe(
      [
        '<session_section id="sec_done" kind="collect" action="done" path="Notes/Spec.md" title="Notes">',
        '<![CDATA[Continue from the merged answers.]]>',
        '<answer id="notes"><![CDATA[Only this fence]]></answer>',
        '</session_section>',
      ].join('\n'),
    );
  });

  it('escapes attributes and CDATA closers in question bodies', () => {
    const xml = formatSessionSectionContext(collectSection({
      title: 'A "form" & notes',
      prompt: 'See ]]> here',
      questions: [
        {
          id: 'notes',
          prompt: 'Say <done> & more',
          type: 'text',
        },
      ],
      answers: { notes: 'close ]]> tag' },
    }));

    expect(xml).toContain('title="A &quot;form&quot; &amp; notes"');
    expect(xml).toContain('<![CDATA[See ]]]]><![CDATA[> here]]>');
    expect(xml).toContain('<prompt><![CDATA[Say <done> & more]]></prompt>');
    expect(xml).toContain('<answer><![CDATA[close ]]]]><![CDATA[> tag]]></answer>');
  });
});
