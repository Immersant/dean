import { ARTIFACT_AUTHORING_APPENDIX } from '@/core/artifacts/deanArtifactPrompt';
import { parseSessionSectionYaml } from '@/core/session-sections/SessionSectionCodec';
import {
  buildDeanSystemPromptAppendices,
  SESSION_SECTION_AUTHORING_APPENDIX,
} from '@/core/session-sections/sessionSectionPrompt';

function authoredExamples(): string[] {
  return [...SESSION_SECTION_AUTHORING_APPENDIX.matchAll(/```dean-session\n([\s\S]*?)\n```/g)]
    .map((match) => match[1]);
}

describe('buildDeanSystemPromptAppendices', () => {
  it('returns empty when the flag is off or missing', () => {
    expect(buildDeanSystemPromptAppendices({ enableEditorSessionSections: false })).toEqual([]);
    expect(buildDeanSystemPromptAppendices(undefined)).toEqual([]);
  });

  it('returns the authoring appendix when the flag is on', () => {
    expect(buildDeanSystemPromptAppendices({ enableEditorSessionSections: true })).toEqual([
      SESSION_SECTION_AUTHORING_APPENDIX,
      ARTIFACT_AUTHORING_APPENDIX,
    ]);
  });

  it('suppresses the appendix for passive and read-only tool policies', () => {
    expect(buildDeanSystemPromptAppendices(
      { enableEditorSessionSections: true },
      { kind: 'passive' },
    )).toEqual([]);
    expect(buildDeanSystemPromptAppendices(
      { enableEditorSessionSections: true },
      { kind: 'read-only' },
    )).toEqual([]);
  });

  it('keeps the appendix for provider-default tool policy', () => {
    expect(buildDeanSystemPromptAppendices(
      { enableEditorSessionSections: true },
      { kind: 'provider-default' },
    )).toEqual([SESSION_SECTION_AUTHORING_APPENDIX, ARTIFACT_AUTHORING_APPENDIX]);
  });

  it('documents standalone new-chat Collect forms without invented conversation ids', () => {
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('startNewChat');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('required submit-button label');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('omit `conversationId` and `epoch`');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('Never invent a conversation id');
  });

  it('documents that bound Collect Act turns already include merged answers', () => {
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('merged questions and current answers');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain(
      'do not tell the model to Read the fence to recover them',
    );
  });

  it('documents split-fence forms that share formId without mixing modes', () => {
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('formId');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('interleave normal editor prose');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain(
      'Never mix bound and standalone under one `formId`',
    );
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain(
      'only on the last member in the note',
    );
  });

  it('strongly defaults to creating dean-session forms instead of chat questionnaires', () => {
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('Default: create');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('Do not wait to be asked');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain('Intake');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).toContain(
      'one blocking fact',
    );
    expect(SESSION_SECTION_AUTHORING_APPENDIX).not.toContain('AskUserQuestion');
    expect(SESSION_SECTION_AUTHORING_APPENDIX).not.toContain(
      'When the user benefits from durable in-note feedback',
    );
  });

  it('provides validator-compatible Act, bound Collect, and standalone Collect examples', () => {
    const examples = authoredExamples();

    expect(examples).toHaveLength(3);
    expect(examples.map((example) => parseSessionSectionYaml(example).kind)).toEqual([
      'act',
      'collect',
      'collect',
    ]);
    expect(examples).toEqual(expect.arrayContaining([
      expect.stringContaining('createdAt:'),
      expect.stringContaining('questions:'),
      expect.stringContaining('options:'),
    ]));
  });

  it('documents dean-artifact display fences separately from session sections', () => {
    expect(ARTIFACT_AUTHORING_APPENDIX).toContain('dean-artifact');
    expect(ARTIFACT_AUTHORING_APPENDIX).toContain('display-only');
    expect(ARTIFACT_AUTHORING_APPENDIX).not.toContain('<script>');
    expect(buildDeanSystemPromptAppendices({ enableEditorSessionSections: true })).toContain(
      ARTIFACT_AUTHORING_APPENDIX,
    );
  });

  it('teaches pinning dean-session forms onto optional workspace boards', () => {
    const prompt = buildDeanSystemPromptAppendices({ enableEditorSessionSections: true }).join('\n\n');

    expect(prompt).toContain('Workspace boards');
    expect(prompt).toContain('type: file');
    expect(prompt).toContain('Kanban');
    expect(prompt).toContain('Dataview');
    expect(prompt).toContain('Excalidraw');
    expect(prompt).toContain('enhancements, not requirements');
  });
});
