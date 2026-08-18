import {
  SESSION_SECTION_LIMITS,
  type SessionSection,
} from '@/core/session-sections/SessionSection';
import {
  parseSessionSectionYaml,
  serializeSessionSectionYaml,
  SessionSectionCodecError,
} from '@/core/session-sections/SessionSectionCodec';
import { validateSessionSection } from '@/core/session-sections/validateSessionSection';

const ACT_YAML = `
schemaVersion: 1
id: sec_01HZX4K2
conversationId: conv-1710000000000-ab12cd34e
epoch: 0
kind: act
title: Follow-ups
status: open
createdAt: 1710000100000
actions:
  - id: review
    label: Review
    prompt: Review this note for consistency.
`.trim();

const COLLECT_SECTION: SessionSection = {
  schemaVersion: 1,
  id: 'sec_01HZX9QQ',
  conversationId: 'conv-1710000000000-ab12cd34e',
  epoch: 2,
  kind: 'collect',
  title: 'Design feedback',
  status: 'open',
  createdAt: 1710000100000,
  actions: [
    {
      id: 'done',
      label: "I'm done",
      prompt: 'The user finished the questionnaire.',
    },
  ],
  questions: [
    {
      id: 'approach',
      prompt: 'Which navigation model should we ship?',
      type: 'single',
      options: [
        { id: 'tabs', label: 'Tab bar' },
        { id: 'sessions', label: 'Session manager only' },
      ],
    },
    {
      id: 'notes',
      prompt: 'Markup or comments',
      type: 'markdown',
    },
  ],
  answers: {
    approach: 'tabs',
    notes: '',
  },
};

const STANDALONE_COLLECT = {
  schemaVersion: 1,
  id: 'standalone_discovery',
  kind: 'collect',
  title: 'Discovery questions',
  status: 'open',
  createdAt: 1710000100000,
  startNewChat: true,
  questions: [
    { id: 'goal', prompt: 'What should we build?', type: 'markdown' },
  ],
  answers: { goal: 'A reviewable workflow.' },
} as const;

describe('SessionSectionCodec', () => {
  it('parses an act section', () => {
    const section = parseSessionSectionYaml(ACT_YAML);
    expect(section.kind).toBe('act');
    expect(section.actions).toHaveLength(1);
    expect(section.actions[0].id).toBe('review');
    expect(section.actions[0].prompt).toContain('Review this note');
    expect(section.questions).toEqual([]);
  });

  it('validates a collect section with answers and co-located actions', () => {
    const section = validateSessionSection(COLLECT_SECTION);
    expect(section.kind).toBe('collect');
    expect(section.epoch).toBe(2);
    expect(section.questions).toHaveLength(2);
    expect(section.answers.approach).toBe('tabs');
    expect(section.actions[0].id).toBe('done');
  });

  it('round-trips act sections through serialize and parse', () => {
    const original = parseSessionSectionYaml(ACT_YAML);
    const serialized = serializeSessionSectionYaml(original);
    const again = parseSessionSectionYaml(serialized);
    expect(again).toEqual(original);
  });

  it('serializes collect sections with actions, questions, and answers', () => {
    const serialized = serializeSessionSectionYaml(COLLECT_SECTION);
    expect(serialized).toMatch(/kind:\s*"?collect"?/);
    expect(serialized).toContain('approach');
    expect(serialized).toContain('done');
    expect(serialized).toContain('tabs');
  });

  it('accepts and round-trips standalone Collect sections without binding fields', () => {
    const section = validateSessionSection(STANDALONE_COLLECT);
    expect(section).toMatchObject({ kind: 'collect', startNewChat: true, actions: [] });
    expect('conversationId' in section).toBe(false);
    expect('epoch' in section).toBe(false);

    const serialized = serializeSessionSectionYaml(section);
    expect(serialized).toContain('startNewChat: true');
    expect(serialized).not.toContain('conversationId:');
    expect(serialized).not.toContain('epoch:');
    expect(parseSessionSectionYaml(serialized)).toEqual(section);
  });

  it.each([
    ['binding', { ...STANDALONE_COLLECT, conversationId: 'conv-1', epoch: 0 }],
    ['actions', { ...STANDALONE_COLLECT, actions: [{ id: 'go', label: 'Go', prompt: 'Go' }] }],
    ['act kind', { ...STANDALONE_COLLECT, kind: 'act' }],
    ['false flag', { ...COLLECT_SECTION, startNewChat: false }],
  ])('rejects ambiguous standalone combination: %s', (_label, value) => {
    expect(() => validateSessionSection(value)).toThrow();
  });

  it('still accepts existing bound Act and Collect sections', () => {
    expect(parseSessionSectionYaml(ACT_YAML).conversationId).toBeTruthy();
    expect(validateSessionSection(COLLECT_SECTION).conversationId).toBeTruthy();
  });

  it('accepts provider session UUIDs as conversationId', () => {
    const section = parseSessionSectionYaml(ACT_YAML.replace(
      'conv-1710000000000-ab12cd34e',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    ));
    expect(section.conversationId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('treats missing epoch as 0', () => {
    const yaml = ACT_YAML.replace(/\nepoch: 0\n/, '\n');
    expect(parseSessionSectionYaml(yaml).epoch).toBe(0);
  });

  it('rejects invalid YAML', () => {
    expect(() => parseSessionSectionYaml('actions: [')).toThrow(SessionSectionCodecError);
  });

  it('rejects oversize fence bodies', () => {
    const huge = `${'a'.repeat(SESSION_SECTION_LIMITS.fenceBodyBytes + 1)}\n`;
    expect(() => parseSessionSectionYaml(huge)).toThrow(/bytes/);
  });

  it('rejects forbidden execution-like fields', () => {
    expect(() => validateSessionSection({
      ...COLLECT_SECTION,
      onClick: 'rm -rf /',
    })).toThrow(/onClick/);
  });

  it('rejects unknown kinds', () => {
    expect(() => parseSessionSectionYaml(ACT_YAML.replace('kind: act', 'kind: wizard'))).toThrow(
      /kind/,
    );
  });

  it('rejects act sections without actions', () => {
    const yaml = ACT_YAML.replace(
      /actions:[\s\S]*$/,
      '',
    );
    expect(() => parseSessionSectionYaml(yaml)).toThrow(/action/);
  });

  it('rejects invalid conversationId paths', () => {
    expect(() => parseSessionSectionYaml(
      ACT_YAML.replace('conv-1710000000000-ab12cd34e', '../escape'),
    )).toThrow(/conversationId/);
  });
});
