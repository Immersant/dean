import { createMockEl } from '@test/helpers/MockElement';

import {
  parseSessionSectionYaml,
  serializeSessionSectionYaml,
  SESSION_SECTION_FENCE_LANGUAGE,
} from '@/core/session-sections';
import { clearSessionSectionDiagnostics } from '@/features/session-sections/SessionSectionDiagnostics';
import {
  buildFenceBlock,
  classifyFenceSlice,
  computeAnswersDigest,
  detectLineEnding,
  expandToFullFence,
  findFenceBySectionId,
  resolveFenceRange,
  writeSessionSectionToNote,
} from '@/features/session-sections/SessionSectionWriteBack';

const COLLECT_BODY = `
schemaVersion: 1
id: sec_collect
conversationId: conv-1
epoch: 0
kind: collect
title: Feedback
status: open
createdAt: 1710000100000
questions:
  - id: approach
    prompt: Which model?
    type: single
    options:
      - id: tabs
        label: Tabs
      - id: sessions
        label: Sessions
answers:
  approach: tabs
actions:
  - id: done
    label: I'm done
    prompt: Continue from the questionnaire.
`.trim();

const ACT_BODY = `
schemaVersion: 1
id: sec_act
conversationId: conv-1
epoch: 0
kind: act
title: Follow-ups
status: open
createdAt: 1710000100000
actions:
  - id: go
    label: Go
    prompt: Do the thing.
`.trim();

const STANDALONE_COLLECT_BODY = `
schemaVersion: 1
id: standalone_collect
kind: collect
title: Discovery
status: open
createdAt: 1710000100000
startNewChat: true
questions:
  - id: goal
    prompt: What should we build?
    type: markdown
answers: {}
`.trim();

/** Answers attached in-memory so fixtures stay within the mock YAML parser's depth. */
function collectWithAnswers(answers: Record<string, string | string[]>) {
  const base = parseSessionSectionYaml(COLLECT_BODY);
  return {
    ...base,
    answers,
  };
}

function noteWithTwoFences(collectBody: string, actBody: string = ACT_BODY): string {
  return (
    `# Intro\n\n`
    + `\`\`\`${SESSION_SECTION_FENCE_LANGUAGE}\n${collectBody}\n\`\`\`\n\n`
    + `\`\`\`${SESSION_SECTION_FENCE_LANGUAGE}\n${actBody}\n\`\`\`\n\n`
    + `# Outro\n`
  );
}

function noteWithFence(body: string): string {
  return `# Intro\n\n\`\`\`${SESSION_SECTION_FENCE_LANGUAGE}\n${body}\n\`\`\`\n\n# Outro\n`;
}

describe('SessionSectionWriteBack', () => {
  beforeEach(() => {
    clearSessionSectionDiagnostics();
  });

  it('detects CRLF vs LF', () => {
    expect(detectLineEnding('a\r\nb')).toBe('\r\n');
    expect(detectLineEnding('a\nb')).toBe('\n');
  });

  it('buildFenceBlock wraps the body with the reserved language', () => {
    const block = buildFenceBlock('id: sec\n', '\n');
    expect(block.startsWith('```' + SESSION_SECTION_FENCE_LANGUAGE + '\n')).toBe(true);
    expect(block.endsWith('```')).toBe(true);
    expect(block).toContain('id: sec');
  });

  it('classifyFenceSlice distinguishes full fence from body', () => {
    expect(classifyFenceSlice('```dean-session\nid: x\n```')).toBe('full-fence');
    expect(classifyFenceSlice('id: x\n')).toBe('body-only');
  });

  it('resolveFenceRange finds a fence by source body match', () => {
    const file = noteWithFence(COLLECT_BODY);
    const el = createMockEl() as unknown as HTMLElement;
    const ctx = { getSectionInfo: () => null } as any;
    const range = resolveFenceRange(file, el, ctx, COLLECT_BODY, 'sec_collect');
    expect(range).not.toBeNull();
    expect(range!.kind).toBe('full-fence');
    const slice = file.slice(range!.start, range!.end);
    expect(slice).toContain('```' + SESSION_SECTION_FENCE_LANGUAGE);
    expect(slice).toContain('sec_collect');
    expect(slice.trimEnd().endsWith('```')).toBe(true);
  });

  it('resolveFenceRange expands body-only getSectionInfo to full fence', () => {
    const file = noteWithTwoFences(COLLECT_BODY);
    const lines = file.split('\n');
    const openLine = lines.findIndex(line => line.startsWith('```' + SESSION_SECTION_FENCE_LANGUAGE));
    const closeLine = lines.findIndex((line, index) => index > openLine && line === '```');
    // Simulate Live Preview: section info covers only YAML body lines.
    const bodyStart = openLine + 1;
    const bodyEnd = closeLine - 1;
    const el = createMockEl() as unknown as HTMLElement;
    const ctx = {
      getSectionInfo: () => ({ lineStart: bodyStart, lineEnd: bodyEnd }),
    } as any;
    const range = resolveFenceRange(file, el, ctx, COLLECT_BODY, 'sec_collect');
    expect(range).not.toBeNull();
    expect(range!.kind).toBe('full-fence');
    const slice = file.slice(range!.start, range!.end);
    expect(slice.startsWith('```' + SESSION_SECTION_FENCE_LANGUAGE)).toBe(true);
    expect(slice.trimEnd().endsWith('```')).toBe(true);
    expect(slice).toContain('sec_collect');
    expect(slice).not.toContain('sec_act');
  });

  it('expandToFullFence recovers when hint ends before the close fence', () => {
    const file = noteWithTwoFences(COLLECT_BODY);
    const openAt = file.indexOf('```' + SESSION_SECTION_FENCE_LANGUAGE);
    const closeAt = file.indexOf('\n```', openAt + 1);
    // Hint covers open + body but stops at the first backtick of the close line.
    const range = expandToFullFence(file, openAt, closeAt + 1);
    expect(range).not.toBeNull();
    expect(range!.kind).toBe('full-fence');
    const slice = file.slice(range!.start, range!.end);
    expect(slice.trimEnd().endsWith('```')).toBe(true);
    expect(slice).not.toContain('sec_act');
  });

  it('findFenceBySectionId picks the matching fence among two', () => {
    const file = noteWithTwoFences(COLLECT_BODY);
    const collect = findFenceBySectionId(file, 'sec_collect');
    const act = findFenceBySectionId(file, 'sec_act');
    expect(collect).not.toBeNull();
    expect(act).not.toBeNull();
    expect(file.slice(collect!.start, collect!.end)).toContain('sec_collect');
    expect(file.slice(act!.start, act!.end)).toContain('sec_act');
    expect(collect!.end).toBeLessThanOrEqual(act!.start);
  });

  it('writeSessionSectionToNote replaces answers without calling chat submit', async () => {
    const section = parseSessionSectionYaml(COLLECT_BODY);
    const updated = {
      ...section,
      answers: { approach: 'sessions' },
    };
    const fileContent = noteWithFence(COLLECT_BODY);
    const file = { path: 'Notes/Spec.md', extension: 'md' };
    const modify = jest.fn().mockResolvedValue(undefined);
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: jest.fn().mockResolvedValue(fileContent),
        modify,
      },
    } as any;
    const el = createMockEl() as unknown as HTMLElement;
    const ctx = { getSectionInfo: () => null } as any;

    const result = await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Spec.md',
      el,
      ctx,
      section: updated,
      originalSource: COLLECT_BODY,
    });

    expect(result).toEqual({ status: 'written' });
    expect(modify).toHaveBeenCalledTimes(1);
    const next = modify.mock.calls[0][1] as string;
    expect(next).toContain('approach: "sessions"');
    expect(next).not.toContain('approach: tabs');
    expect(next).toContain('# Intro');
    expect(next).toContain('# Outro');
    expect(next).not.toContain('``````');
  });

  it('writeSessionSectionToNote keeps adjacent act fence intact with multi answers', async () => {
    const updated = collectWithAnswers({
      approach: 'sessions',
      features: ['a', 'b'],
      notes: 'hello',
    });
    const fileContent = noteWithTwoFences(COLLECT_BODY);
    const file = { path: 'Notes/Spec.md', extension: 'md' };
    const modify = jest.fn().mockResolvedValue(undefined);
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: jest.fn().mockResolvedValue(fileContent),
        modify,
      },
    } as any;
    const el = createMockEl() as unknown as HTMLElement;

    // Body-only section info (the bug that produced ``````dean-session).
    const lines = fileContent.split('\n');
    const openLine = lines.findIndex(line => line.startsWith('```' + SESSION_SECTION_FENCE_LANGUAGE));
    const closeLine = lines.findIndex((line, index) => index > openLine && line === '```');
    const ctx = {
      getSectionInfo: () => ({
        lineStart: openLine + 1,
        lineEnd: closeLine - 1,
      }),
    } as any;

    const result = await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Spec.md',
      el,
      ctx,
      section: updated,
      originalSource: COLLECT_BODY,
    });

    expect(result).toEqual({ status: 'written' });
    const next = modify.mock.calls[0][1] as string;
    expect(next).not.toContain('``````');
    expect(next.match(/```dean-session/g)?.length).toBe(2);
    expect(next.match(/^```$/gm)?.length).toBe(2);

    // Both fences still parse.
    const collectRange = findFenceBySectionId(next, 'sec_collect');
    const actRange = findFenceBySectionId(next, 'sec_act');
    expect(collectRange).not.toBeNull();
    expect(actRange).not.toBeNull();

    const open = '```' + SESSION_SECTION_FENCE_LANGUAGE + '\n';
    const collectSlice = next.slice(collectRange!.start, collectRange!.end);
    const collectBody = collectSlice.slice(open.length).replace(/\n```\s*$/, '\n');
    const parsed = parseSessionSectionYaml(collectBody);
    expect(parsed.answers.approach).toBe('sessions');
    expect(parsed.answers.features).toEqual(['a', 'b']);
    expect(parsed.answers.notes).toBe('hello');

    const actSlice = next.slice(actRange!.start, actRange!.end);
    const actBody = actSlice.slice(open.length).replace(/\n```\s*$/, '\n');
    expect(parseSessionSectionYaml(actBody).id).toBe('sec_act');
  });

  it('writeSessionSectionToNote does not glue fences when section info omits the close line', async () => {
    const section = parseSessionSectionYaml(COLLECT_BODY);
    const updated = {
      ...section,
      answers: { approach: 'sessions' },
    };
    const fileContent = noteWithTwoFences(COLLECT_BODY);
    const lines = fileContent.split('\n');
    const openLine = lines.findIndex(line => line.startsWith('```' + SESSION_SECTION_FENCE_LANGUAGE));
    const closeLine = lines.findIndex((line, index) => index > openLine && line === '```');
    // Open through last body line — the historical corruption path.
    const file = { path: 'Notes/Spec.md', extension: 'md' };
    const modify = jest.fn().mockResolvedValue(undefined);
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: jest.fn().mockResolvedValue(fileContent),
        modify,
      },
    } as any;
    const el = createMockEl() as unknown as HTMLElement;
    const ctx = {
      getSectionInfo: () => ({ lineStart: openLine, lineEnd: closeLine - 1 }),
    } as any;

    const result = await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Spec.md',
      el,
      ctx,
      section: updated,
      originalSource: COLLECT_BODY,
    });

    expect(result).toEqual({ status: 'written' });
    const next = modify.mock.calls[0][1] as string;
    expect(next).not.toContain('``````');
    expect(next).toContain('sec_act');
    expect(next).toContain('# Outro');
  });

  it('round-trips multi-select answers through serialize and write', async () => {
    const updated = collectWithAnswers({ features: ['a', 'b'] });
    const serialized = serializeSessionSectionYaml(updated);
    expect(serialized).toMatch(/features:/);
    expect(serialized).toContain('"a"');
    expect(serialized).toContain('"b"');
    const againFromSerialize = parseSessionSectionYaml(serialized);
    expect(againFromSerialize.answers.features).toEqual(['a', 'b']);

    const fileContent = noteWithFence(COLLECT_BODY);
    const file = { path: 'Notes/Spec.md', extension: 'md' };
    const modify = jest.fn().mockResolvedValue(undefined);
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: jest.fn().mockResolvedValue(fileContent),
        modify,
      },
    } as any;

    const result = await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Spec.md',
      el: createMockEl() as unknown as HTMLElement,
      ctx: { getSectionInfo: () => null } as any,
      section: updated,
      originalSource: COLLECT_BODY,
    });
    expect(result).toEqual({ status: 'written' });

    const next = modify.mock.calls[0][1] as string;
    const range = findFenceBySectionId(next, 'sec_collect')!;
    const open = '```' + SESSION_SECTION_FENCE_LANGUAGE + '\n';
    const body = next.slice(range.start, range.end).slice(open.length).replace(/\n```\s*$/, '\n');
    const again = parseSessionSectionYaml(body);
    expect(again.answers.features).toEqual(['a', 'b']);
  });

  it('round-trips standalone collect answers without binding fields', async () => {
    const section = parseSessionSectionYaml(STANDALONE_COLLECT_BODY);
    const updated = {
      ...section,
      answers: { goal: 'A fresh draft.' },
    };
    const fileContent = noteWithFence(STANDALONE_COLLECT_BODY);
    const file = { path: 'Notes/Discovery.md', extension: 'md' };
    const modify = jest.fn().mockResolvedValue(undefined);
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: jest.fn().mockResolvedValue(fileContent),
        modify,
      },
    } as any;

    const result = await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Discovery.md',
      el: createMockEl() as unknown as HTMLElement,
      ctx: { getSectionInfo: () => null } as any,
      section: updated,
      originalSource: STANDALONE_COLLECT_BODY,
    });

    expect(result).toEqual({ status: 'written' });
    const next = modify.mock.calls[0][1] as string;
    const range = findFenceBySectionId(next, 'standalone_collect')!;
    const open = '```' + SESSION_SECTION_FENCE_LANGUAGE + '\n';
    const body = next.slice(range.start, range.end).slice(open.length).replace(/\n```\s*$/, '\n');
    const parsed = parseSessionSectionYaml(body);
    expect(parsed).toMatchObject({
      kind: 'collect',
      startNewChat: true,
      answers: { goal: 'A fresh draft.' },
    });
    expect('conversationId' in parsed).toBe(false);
    expect('epoch' in parsed).toBe(false);
  });

  it('writeSessionSectionToNote skips when content is unchanged', async () => {
    const section = parseSessionSectionYaml(COLLECT_BODY);
    const file = { path: 'Notes/Spec.md', extension: 'md' };
    const firstWrite = noteWithFence(COLLECT_BODY);
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: jest.fn()
          .mockResolvedValueOnce(firstWrite)
          .mockResolvedValueOnce(firstWrite),
        modify: jest.fn().mockImplementation(async (_f: unknown, content: string) => {
          (app.vault.read as jest.Mock).mockResolvedValue(content);
        }),
      },
    } as any;
    const el = createMockEl() as unknown as HTMLElement;
    const ctx = { getSectionInfo: () => null } as any;

    await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Spec.md',
      el,
      ctx,
      section,
      originalSource: COLLECT_BODY,
    });
    const second = await writeSessionSectionToNote({
      app,
      notePath: 'Notes/Spec.md',
      el,
      ctx,
      section,
      originalSource: COLLECT_BODY,
    });

    expect(computeAnswersDigest('Notes/Spec.md', 'sec_collect', section.answers))
      .toBe(computeAnswersDigest('Notes/Spec.md', 'sec_collect', { approach: 'tabs' }));
    expect(second.status === 'written' || second.status === 'skipped').toBe(true);
  });
});
